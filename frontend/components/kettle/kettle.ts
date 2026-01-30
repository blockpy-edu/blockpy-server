/***
 * Kettle is an editor for TypeScript (and possibly other languages). It's basically a
 * completely pared down version of BlockPy's regular client.
 */

import * as ko from 'knockout';
import {AssignmentInterface, AssignmentInterfaceJson, EditorMode} from "../assignment_interface";
import {Assignment} from "../../models/assignment";
import {Timer} from "../../utilities/timer";
import {formatClock, pad, titleCase} from "../../utilities/text";
import {CompilationResult, compile, delint} from "../../utilities/ts_compiler";
import * as ts from "typescript";
import {decode} from "../../utilities/vlq";
import {QuizPoolRandomness} from "../quizzes/quiz";

import { WebR } from 'webr';

export const CONSOLE_API_COMMAND_LIST = ["log", "error", "info", "warning", "table", "clear"];
export type ConsoleAPICommand = "log" | "error" | "info" | "warning" | "table" | "clear";
export type ConsoleAPI = Record<ConsoleAPICommand, (...message: any[])=> void>;

/**
 * Current strategy for safety is to extract out all the actual execution code to an iframe script
 * that is loaded from the server with appropriate security settings. Then we can just send messages
 * back and forth between the two.
 */

declare class ConTodo {
    constructor(node: HTMLElement, options: Record<string, any>);
    createDocumentNode(): void;
    api: ConsoleAPI;
}


export function extractFromPool(pool: string, splitter: RegExp, seed: number): string {
    const pools = pool.split(splitter);
    if (pools.length <= 2) {
        return "// Invalid Pool - remember to include header and footer!";
    }
    const chosenPool = pools[1 + (seed % (pools.length-2))];
    const poolParts = [pools[0], chosenPool, pools[pools.length-1]];
    return poolParts.join('\n');
}

interface KettleInterfaceJson extends AssignmentInterfaceJson {
    smallLayout: boolean;
    partId: string;
    initialCode: string;
    language: KettleLanguages;
}

export type SourceCodeMapping = Record<number, Record<number, [number, number]>>;
const EXTRACT_SOURCE_CODE_MAP = /[#@]\s(source(?:Mapping)?URL)=data:application\/json;base64,\s*(\S+)/
function extractSourceCodeMap(code: string): SourceCodeMapping {
    code = code.match(EXTRACT_SOURCE_CODE_MAP)[2];
    let lines = JSON.parse(atob(code)).mappings.split(';');
    let lineMap: Record<number, Record<number, [number, number]>> = {};
    const latest= [0,0,0,0];
    lines.forEach((line: string, compiledRow: number) => {
        latest[0] = 0;
        //latest[3] = 0;
        return line.split(",").forEach((mapping) => {
            const offsets = decode(mapping);
            offsets.forEach((v, i) => latest[i] += v);
            const [compiledColumn, sourceFile, originalRow, originalColumn] = latest;
            if (!(compiledRow in lineMap)) { lineMap[compiledRow] = {}; }
            lineMap[compiledRow][compiledColumn] = [originalRow, originalColumn];
        });
    });

    return lineMap;
}

/**
 * This is a modified version of the stack-utils parser, which is licensed under the MIT license.
 * https://github.com/tapjs/stack-utils/tree/main
 *
 */
const STACK_TRACE_REGEX = new RegExp(
  '^' +
    // Sometimes we strip out the '    at' because it's noisy
  '(?:\\s*at )?' +
    // $1 = ctor if 'new'
  '(?:(new) )?' +
    // $2 = function name (can be literally anything)
    // May contain method at the end as [as xyz]
  '(?:(.*?) \\()?' +
    // (eval at <anonymous> (file.js:1:1),
    // $3 = eval origin
    // $4:$5:$6 are eval file/line/col, but not normally reported
  '(?:eval at ([^ ]+) \\((.+?):(\\d+):(\\d+)\\), )?' +
    // file:line:col
    // $7:$8:$9
    // $10 = 'native' if native
  '(?:(.+?):(\\d+):(\\d+)|(native))' +
    // maybe close the paren, then end
    // if $11 is ), then we only allow balanced parens in the filename
    // any imbalance is placed on the fname.  This is a heuristic, and
    // bound to be incorrect in some edge cases.  The bet is that
    // having weird characters in method names is more common than
    // having weird characters in filenames, which seems reasonable.
  '(\\)?)$',
);

//const methodRe = /^(.*?) \[as (.*?)\]$/;

const BASIC_INSTRUCTOR_CODE = `
test("First Test", () => {
    expect(5).toBe(5);
});
`;

function cleanStack(stack: string, sourceCodeMapping: SourceCodeMapping, originalCode: string, offset: number = 0) {
    const originalLines = originalCode.split("\n");
    const lines = stack.split("\n");
    let cleaned = [];
    let initialLine: number | null = null;
    const restLines = lines.slice(1);
    restLines.reverse();
    for (let originalLine of restLines) {
        const line = originalLine.trim().match(STACK_TRACE_REGEX)
        if (!line) {
            cleaned.push(originalLine);
            continue;
        }
        //console.log(line);
        // Inner nested truly anonymous functions are called eval, so that's a little confusing.
        const functionName = line[2] === "eval" ? "eval" : !line[2] ? "instructorCode" : line[2];
        const inModule = !(line[7].startsWith("blob:"));
        let [lineNumber, colNumber] = [parseInt(line[8], 10), parseInt(line[9], 10)];
        //console.log(sourceCodeMapping, lineNumber, colNumber);
        if (initialLine === null) {
            initialLine = lineNumber;
        } else {
            const best_match = getValueForLowestKey(sourceCodeMapping[lineNumber-2], colNumber);
            if (best_match !== undefined) {
                [lineNumber, colNumber] = best_match;
            }
        }
        //lineNumber -= initialLine;
        lineNumber += offset;
        if (inModule) {
            cleaned.push("    at " + functionName + " (line " + lineNumber + ", column " + colNumber + ")");
        }
    }
    cleaned.push(lines[0]);
    cleaned.reverse();
    return cleaned.join("\n");
}

function getValueForLowestKey(object: Record<number, any>, index: number) {
    let returned;

    for (const key in object) {
        if((key as unknown as number) > index) break;
        returned = object[key];
    }

    return returned;
}

function handleKettleSystemError(error: KettleEngineSystemError, request: FeedbackExecutionRequest) {
    const result = [`${titleCase(error.category)} error in ${titleCase(error.place)} code:\n`];
    const defaultText = error.error.text === "[object Object]" ? JSON.stringify(error.error.raw) : error.error.text;
    if (error.place === "student" || error.place === "instructor") {
        const sourceCodeMapping = request[error.place].sourceCodeMapping;
        const originalCode = request[error.place].original;
        if (error.category === "syntax" || error.category === "runtime") {
            const offset = request[error.place].offset[error.category];
            if (error.error.stack) {
                result.push(cleanStack(error.error.stack, sourceCodeMapping, originalCode));
            } else {
                result.push(defaultText);
            }
        } else {
            result.push(defaultText);
        }
    } else {
        result.push(defaultText);
    }
    return result.join("\n");
}

export function processTypeScriptDiagnostic(diagnostic: ts.Diagnostic, where: string) {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      return (`${where}(Line ${line + 1}, Position ${character + 1}): ${message}`);
    } else {
      return (where + ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    }
}


interface KettleEngineSystemError {
    place: string,
    category: string,
    error: {
        stack: string,
        message: string,
        text: string,
        raw: any
    }
}


interface ParentPost {
    type: string,
    contents: KettleEngineSystemError | string[],
}



const EXECUTION_HEADER = `// Execution Header
let silenceConsole = false;
let _signedKey = null;
const parentPost = (type, contents, override=false) => {
    //contents = JSON.parse(JSON.stringify(contents));
    if (!silenceConsole || override) {
        postMessage({type: type, contents: contents});
    }
};
const console = {
    log: (...text) => parentPost("console.log", text),
    error: (...text) => parentPost("console.error", text),
    info: (...text) => parentPost("console.info", text),
    warning: (...text) => parentPost("console.warning", text),
    table: (...text) => parentPost("console.table", text),
    clear: () => parentPost("console.clear", [])
};
const _updateStatus = (message) => {
    parentPost("execution.update", [message]);
};
const _kettleSystemError = (place, category, error) => {
    parentPost("execution.error", {
        place,
        category,
        error: {
            text: error.toString(),
            message: error.message,
            stack: error.stack,
            raw: JSON.parse(JSON.stringify(error))
        }
    });
}
// Listen for cool stuff
addEventListener('message', (message) => {
    console.log("Web Worker internally heard", message)
});
`;

const EXECUTION_INSTRUCTOR = `// Instructor Header
(function() {
const isDeepEqual = (object1, object2) => {
    return JSON.stringify(object1) === JSON.stringify(object2);
};


const DEFAULT_SUITE = "__GLOBAL";
let currentSuite = DEFAULT_SUITE, currentTest = null;
let _results = {[DEFAULT_SUITE]: { status: "success", tests: {} }};
const instructor_log = (...text) => {
    parentPost("instructor.log", text, true);
};
const describe = (name, tests) => {
    currentSuite = name;
    if (name in _results) {
        throw new Error("Test suite name already exists: "+name);
    }
    _results[currentSuite] = { status: "success", tests: {} };
    try {
        tests();
    } catch (failedSuite) {
        _results[name].status = "failed: "+failedSuite.toString();
    }
    currentSuite = DEFAULT_SUITE;
}
const test = (name, assertions) => {
    currentTest = name;
    _results[currentSuite].tests[name] = { status: "success", expects: [] };
    silenceConsole = true;
    try {
        assertions();
    } catch (failedTest) {
        _results[currentSuite].tests[name].status = "failed: "+failedTest.toString();
        _results[currentSuite].tests[name].expects.push(
            "error"
        );
    } finally {
        silenceConsole = false;
    }
    currentTest = null;
}
const getExpects = () => {
    if (currentTest === null) {
        throw new Error("Trying to run expect outside of a test.");
    }
    return _results[currentSuite].tests[currentTest].expects;
}
const expect = (actual) => {
    return {
        toBe: (expected) => {
            const expects = getExpects();
            expects.push(actual === expected ? "passed" : "failed");
        },
        toEqual: (expected) => {
            const expects = getExpects();
            expects.push(isDeepEqual(actual, expected) ? "passed" : "failed");
        }
    }
};
`;

const EXECUTION_FOOTER = `// Execution Footer
parentPost("instructor.tests", _results);
})();
parentPost("execution.finished", []);
close();
`;
const EXECUTION_FOOTER_WITHOUT_TESTS = `// Execution Footer
parentPost("execution.finished", []);
close();
`;

interface ProgramExecutionRequest {
    code: string;
    offset: {
        syntax: number,
        runtime: number
    }
    errors: ts.Diagnostic[];
    original: string;
    sourceCodeMapping: SourceCodeMapping;
}

interface FeedbackExecutionRequest {
    mode: 'run' | 'evaluate';
    header: string;
    student: ProgramExecutionRequest;
    instructor: ProgramExecutionRequest | null;
    assembled: string;
    noErrors: boolean;
    signedKey: string;
}

interface WrappedCode {
    code: string;
    offset: {
        syntax: number,
        runtime: number,
        analyzer?: number
    };
    lineCount: number;
}

const wrapStudentCode = (code: string, offset: number = 0, locals: Map<string, string>): WrappedCode => {
    code = code.replace(/[\\`$]/g, '\\$&');
    code += "\nreturn {" + Array.from(locals.keys()).join(", ")+"};";
    const wrapped = `_updateStatus("Executing Student Code"); // $Student Code
student = {};
studentNamespace = {};
try {
    const __studentFunction = Function("studentCode", \`${code}\`).bind(studentNamespace);
    try {
        student = __studentFunction();
    } catch (e) {
        _kettleSystemError('student', "runtime", e);
    }
} catch (e) {
    _kettleSystemError('student', "syntax", e);
}`.trim();
    return {
        code: wrapped,
        offset: {
            syntax: 4 + offset,
            runtime: 6 + offset
        },
        lineCount: wrapped.split("\n").length + offset
    }
};

const wrapInstructorCode = (code: string, signedKey: string, offset: number = 0, typeInformation: string): WrappedCode => {
    //code = code.replace(/[\\`$]/g, '\\$&');
    const wrapped = `_updateStatus("Executing Instructor Code"); // Instructor Code
_results['_signedKey'] = '${signedKey}'; let typeInformation={}; try {typeInformation = ${typeInformation};} catch (e) {_kettleSystemError("instructor", "runtime", e);}
try {
    ${code}
} catch (e) {
    _kettleSystemError('instructor', "runtime", e);
}
`.trim();
    return {
        code: wrapped,
        offset: {
            syntax: 3 + offset,
            runtime: 5 + offset,
        },
        lineCount: wrapped.split("\n").length + offset
    }
};

export function makeExecutionRequest(studentCode: string, instructorCode: string | false): FeedbackExecutionRequest {
    //
    // TODO: Handle strings with blank lines inside?
    studentCode = studentCode.replace("\n\n", "\n//\n");
    const studentResults: CompilationResult = compile(studentCode, ["es2015"]);
    const studentLocals = studentResults.locals;
    const headerOffset = EXECUTION_HEADER.split("\n").length;
    const wrappedStudent = wrapStudentCode(studentResults.code, headerOffset, studentLocals);
    const assemblage = [EXECUTION_HEADER, wrappedStudent.code];
    const signedKey = crypto.randomUUID();

    // Add in instructor code if available
    let instructor: ProgramExecutionRequest | null = null;
    if (instructorCode !== false) {
        instructorCode = instructorCode.replace("\n\n", "\n//\n");
        const instructorResults: CompilationResult = compile(instructorCode, ["es2015"]);
        const instructorHeaderOffset = EXECUTION_INSTRUCTOR.split("\n").length + wrappedStudent.lineCount;
        const studentTypeInformation = JSON.stringify(studentResults.typeInformation);
        const wrappedInstructor = wrapInstructorCode(instructorResults.code, signedKey, instructorHeaderOffset, studentTypeInformation);
        assemblage.push(EXECUTION_INSTRUCTOR, wrappedInstructor.code, EXECUTION_FOOTER);
        instructor = {
            ...wrappedInstructor,
            errors: instructorResults.diagnostics,
            original: instructorCode,
            sourceCodeMapping: extractSourceCodeMap(instructorResults.code)
        };
    } else {
        assemblage.push(EXECUTION_FOOTER_WITHOUT_TESTS);
    }
    const assembled = assemblage.join("\n");

    return {
        mode: instructorCode !== false ? 'evaluate' : 'run',
        assembled,
        header: EXECUTION_HEADER,
        student: {
            ...wrappedStudent,
            errors: studentResults.diagnostics,
            original: studentCode,
            sourceCodeMapping: extractSourceCodeMap(studentResults.code)
        },
        instructor,
        signedKey,
        noErrors:!(studentResults.diagnostics.length > 0 ||
            instructor?.errors.length > 0),
    };
}

interface KettleConsoleLine {
    type: string;
    contents: any[];
}

export class KettleConsole implements ConsoleAPI {
    contodo: ConTodo | null;
    // Human readable output log for convenience
    history: KettleConsoleLine[];

    constructor(target: HTMLElement) {
        this.contodo = new ConTodo(target, {
            autostart: false,
            showDebugging: false,
            showTimestamp: false
            // TODO: Stop this from using the real console too, please
        });
        this.contodo.createDocumentNode();
        this.history = [];
    }

    _logEvent(type: string, contents: any[]) {
        this.history.push({type, contents});
    }

    clear(info: boolean = false) {
        this.contodo.api.clear(info);
        this.history.push({type: "clear", contents: []});
    }

    log(...message: any[]) {
        this.contodo.api.log(...message);
        this._logEvent("log", message);
    }

    error(...message: any[]) {
        this.contodo.api.error(...message);
        this._logEvent("error", message);
    }

    info(...message: any[]) {
        this.contodo.api.info(...message);
        this._logEvent("info", message);
    }

    warning(...message: any[]) {
        this.contodo.api.warning(...message);
        this._logEvent("warning", message);
    }

    table(...message: any[]) {
        this.contodo.api.table(...message);
        this._logEvent("table", message);
    }
}

interface TestCollection {
    expects: string[];
    status: string;
}
interface TestSuite {
    tests: TestCollection;
    status: string;
}

const POOL_SEPARATORS = {
    TESTS: /\/\*{4,}# .+ #\*{4,}\//,
    INSTRUCTIONS: /<!-{4,}# .+ #-{4,}>/
};

export enum KettleLanguages {
    TYPESCRIPT = "typescript",
    JAVASCRIPT = "javascript",
    PYTHON = "python",
    R = "r",
}


export class Kettle extends AssignmentInterface {
    errorMessage: ko.Observable<string>;
    editorMode: ko.Observable<EditorMode>;
    isDirty: ko.Observable<boolean>;
    isExecuting: ko.Observable<boolean>;
    isLoading: ko.Observable<boolean>;
    isDebugMode: ko.Observable<boolean>;
    currentTime: ko.Observable<string>;
    executionTimer: Timer;
    language: ko.Observable<KettleLanguages>;
    mimeLanguage: ko.PureComputed<string>;

    seed: ko.Observable<number>;
    poolRandomness: ko.Observable<QuizPoolRandomness>;

    webR: WebR | null;

    console: KettleConsole | null;
    iframe: HTMLIFrameElement | null;
    latestErrors: string[];
    latestFeedback: string;
    // Decimal score
    latestTestScore: ko.Observable<number>;

    // Visuals from Pools
    poolInstructions: ko.PureComputed<string>;
    poolTests: ko.PureComputed<string>;

    smallLayout: ko.Observable<boolean>;
    startedSmallLayout: boolean;
    partId: ko.Observable<string>;
    initialCode: string;

    runText: ko.PureComputed<string>;

    subscriptions: {
        currentAssignmentId: ko.Subscription;
        submission: ko.Subscription;
        code: ko.Subscription;
    }

    timeClock: NodeJS.Timeout | null;
    throttleSaving: NodeJS.Timeout | null;
    executionConfirmation: NodeJS.Timeout | null;
    SAVE_DELAY: number = 1000;
    private latestListener: EventListener;

    constructor(params: KettleInterfaceJson) {
        super(params);
        this.editorMode = ko.observable(EditorMode.SUBMISSION);
        this.errorMessage = ko.observable("");
        this.subscriptions = {currentAssignmentId: null, code: null, submission: null};
        this.isDirty = ko.observable(false);
        this.isLoading = ko.observable(true);
        this.isExecuting = ko.observable(false);
        this.currentTime = ko.observable(formatClock());
        // For internal development
        this.isDebugMode = ko.observable(false);

        this.startedSmallLayout = params.smallLayout || false;
        this.smallLayout = ko.observable(this.startedSmallLayout);
        this.partId = ko.observable(params.partId || "");
        this.initialCode = params.initialCode || "";

        this.language = ko.observable<KettleLanguages>(params.language || KettleLanguages.TYPESCRIPT);

        this.poolRandomness = ko.observable<QuizPoolRandomness>(QuizPoolRandomness.NONE);
        this.seed = ko.observable<number>(0);

        this.console = null;
        this.iframe = null;
        this.latestErrors = [];
        this.latestFeedback = "";
        this.latestTestScore = ko.observable(0);
        this.latestListener = null;
        this.webR = null;

        this.executionTimer = new Timer(".kettle-clock");

        this.timeClock = setInterval(() => {
            this.currentTime(formatClock());
        }, 3000);

        this.throttleSaving = null;
        this.executionConfirmation = null;

        this.subscriptions.currentAssignmentId = this.currentAssignmentId.subscribe((newId) => {
            this.loadExecutionEngine(newId);
        }, this);

        this.subscriptions.submission = this.submission.subscribe((submission) => {
            this.seed(submission.id);
            if (this.subscriptions.code) {
                this.subscriptions.code.dispose();
            }
            this.subscriptions.code = <ko.Subscription>submission.code.subscribe((code) => {
                this.saveStudentAnswer();
            }, this);
        }, this);

        this.poolTests = ko.pureComputed(() => {
            const onRun = this.assignment().onRun();
            if (this.poolRandomness() === QuizPoolRandomness.SEED) {
                return extractFromPool(onRun, POOL_SEPARATORS.TESTS, this.seed());
            } else {
                return onRun;
            }
        });
        this.poolInstructions = ko.pureComputed(() => {
            const instructions = this.assignment().instructions();
            if (this.poolRandomness() === QuizPoolRandomness.SEED) {
                return extractFromPool(instructions, POOL_SEPARATORS.INSTRUCTIONS, this.seed());
            } else {
                return instructions;
            }
        });
        this.runText = ko.pureComputed(() => {
            return this.partId().length ? "Run" : "Run and Grade";
        });

        this.mimeLanguage = ko.pureComputed(() => {
            switch (this.language()) {
                case KettleLanguages.TYPESCRIPT:
                    return "text/typescript";
                case KettleLanguages.JAVASCRIPT:
                    return "text/javascript";
                case KettleLanguages.PYTHON:
                    return "text/python";
                case KettleLanguages.R:
                    return "text/x-rsrc";
                default:
                    return "text/plain";
            }
        });

        this.loadExecutionEngine(this.currentAssignmentId());
    }

    debugLog(...args: any[]) {
        if (this.isDebugMode()) {
            console.log(...args);
        }
    }

    updateStatus(message: string, spinner=true) {
        $(".kettle-status").text(message);
        $(".kettle-working-spinner").toggle(spinner);
    }

    updateFeedback(message: string) {
        $(".kettle-feedback").html(message.toString());
        if (message) {
            this.logFeedback(message.toString());
        }
    }

    startEditor() {
        this.isLoading(true);
        // Reset UI stuff
        this.isExecuting(false);
        this.executionTimer.reset();
        this.errorMessage("");
        this.isDirty(false);
        // Create or reset console
        if (this.console === null) {
            this.console = new KettleConsole(document.querySelector(".kettle-console"));
        } else {
            this.console.clear();
        }
        this.updateFeedback("");
        // Find the iframe
        this.iframe = <HTMLIFrameElement>document.getElementsByClassName("kettle-execution-iframe")[0];
        // Clear out old errors
        this.latestErrors = [];

        if (this.language() === KettleLanguages.R) {
            this.webR = new WebR();
            // @ts-ignore
            this.webR.init().then(() => {
                this.restoreRunButtons();
                this.console.info("Ready to run R!");
                this.updateStatus("Ready", false);
                this.isLoading(false);
            });
        } else {
            // Set up buttons
            this.restoreRunButtons();

            // Let the user know we're good
            this.console.info("Ready to run!");
            this.updateStatus("Ready", false);
            this.isLoading(false);
        }
    }

    logExecution(eventType = "Run.Program") {
        this.logEvent(eventType, "kettle", "run",
                JSON.stringify({
                    "code": this.submission().code(),
                    "output": JSON.stringify(this.console.history),
                    "errors": JSON.stringify(this.latestErrors),
                    "timer": this.executionTimer.time()
                }, null, 2), this.assignment().url(), () => {});
    }

    logCompilation() {
        this.logEvent("Compile", "kettle", "compile",
                JSON.stringify({
                    "code": this.submission().code()
                }, null, 2), this.assignment().url(), () => {});
    }

    logFeedback(feedback: string) {
        this.logEvent("Intervention", "kettle", "",
                feedback, this.assignment().url(), () => {});
    }

    handleExecutionEvents(event: MessageEvent, feedbackRequest: FeedbackExecutionRequest) {
        const handled = CONSOLE_API_COMMAND_LIST.find((type: ConsoleAPICommand) => {
            if (event.data.type === `console.${type}`) {
                this.debugLog("INSIDE Main Kettle Object", event);
                this.console[type](...event.data.contents);
                return type;
            }
            return false;
        })
        if (event.data.type === "execution.begun") {
            clearTimeout(this.executionConfirmation);
        }
        if (event.data.type === "execution.error") {
            const data = event.data.contents as KettleEngineSystemError;
            this.updateStatus(`${data.category} ${data.place} Error`, false);
            const message = handleKettleSystemError(data, feedbackRequest);
            this.console.error(message);
            this.latestErrors.push(message);
            this.updateFeedback(`There were ${data.category} errors in the ${data.place} code.
                Please see the console more information.`);
        } else if (event.data.type === "execution.update") {
            this.updateStatus(event.data.contents[0]);
        } else if (event.data.type === "execution.finished") {
            this.handleExecutionStopped("Execution Finished");
            if (feedbackRequest.mode === "evaluate") {
                this.submit(this.latestTestScore(), () => {});
            }
        } else if (event.data.type === "instructor.tests") {
            this.debugLog("Instructor Test Results", event.data.contents);
            try {
                this.handleTestResults(event, feedbackRequest);
            } catch (e) {
                this.console.error("Error handling test results", e);
                this.latestErrors.push(e.toString());
                this.updateFeedback("There was an error handling the test results. Please notify the instructor.");
            }
        } else if (event.data.type === 'instructor.log') {
            this.console.log(...event.data.contents);
        } else if (!handled) {
            if (event.data.source === "react-devtools-content-script") {
                return false;
            }
            this.debugLog("INSIDE Main Kettle Object", event);
            //this.console.error("Unknown Execution Event: ", event);
            this.latestErrors.push("Unknown Execution Event: "+JSON.stringify(event));
        }
    }

    handleTestResults(event: MessageEvent<any>, feedbackRequest: FeedbackExecutionRequest) {
        const assertions: string[] = [];
        let allPassed = true;
        let totalPassed = 0, totalTests = 0;
        let testResults = event.data.contents;
        /*if (testResults['_signedKey'] !== feedbackRequest.signedKey) {
            this.updateFeedback("There was an error while processing the instructor tests.\n" +
                "The cryptographic keys did not match. Are you doing something strange? Contact Dr. Bart, please.");
            return;
        }*/
        Object.entries(testResults).forEach(
            ([suiteName, suite]: [string, TestSuite]) => {
                if (suiteName === "_signedKey") { return };
                return Object.entries(suite.tests).forEach(
                    ([testName, test]: [string, TestCollection]) => {
                        const passed = test.expects.every((result: string) => result === "passed");
                        totalPassed += passed ? 1 : 0;
                        totalTests += 1;
                        assertions.push(
                            (passed ? "✅" : "❌")+" "+
                            (suiteName === "__GLOBAL" ? testName : suiteName +") "+ testName),
                        );
                        allPassed = allPassed && passed;
                    }
                );
            }
        )
        this.updateFeedback("Instructor unit test results:<br>"+
            assertions.join("\n<br>\n")+"<br>"+
            (allPassed ? "All the tests are passing 100%. Good work!" :
                `${totalPassed}/${totalTests} tests are currently passing. You are free to keep working.`)
        );
        const newestScore = Math.min(1, Math.max(0, totalPassed/totalTests));
        this.latestTestScore(Math.max(this.latestTestScore(), newestScore));
    }

    logTypeScriptErrors(request: ProgramExecutionRequest, where: string = "") {
        where = where.length ? where+" " : where;
        request.errors.map(
            (diagnostic) => processTypeScriptDiagnostic(diagnostic, where)
        ).forEach(
            (error: string) => {
                this.console.error(error);
                this.latestErrors.push(error);
            }
        );
    }

    handleExecutionStarted() {
        this.updateStatus("Starting");
        this.executionTimer.start();
        this.isExecuting(true);
    }

    /**
     * Also logs the execution remotely, so MUST be the last thing we do.
     * @param reason
     */
    handleExecutionStopped(reason: string) {
        this.restoreRunButtons();
        this.isExecuting(false);
        this.executionTimer.stop();
        clearTimeout(this.executionConfirmation);
        this.updateStatus(reason, false);
        this.logExecution();
        if (this.latestListener !== null) {
            window.removeEventListener('message', this.latestListener);
            this.latestListener = null;
        }
    }

    possibleExecutionFailure(request: FeedbackExecutionRequest, attempts: number) {
        if (attempts <= 0) {
            this.console.error("The execution engine failed to load after several attempts. Please notify the instructor.");
            this.updateFeedback("The execution engine failed to load. Please notify the instructor.");
            this.handleExecutionStopped("Execution Failure");
        } else {
            this.console.error(`The execution engine failed to load. Trying to restart (${attempts} attempts left).`);
            this.iframe.onload = () => {
                this.executeRequest(request, attempts-1);
            };
            // Trigger page reload
            this.iframe.src = this.iframe.src;
        }
    }

    executeRequest(request: FeedbackExecutionRequest, attempts=3) {
        clearTimeout(this.executionConfirmation);
        // Check that the iframe is okay
        this.executionConfirmation = setTimeout(() => {
            this.possibleExecutionFailure(request, attempts);
        }, 5000);
        // Clear out any existing listeners
        if (this.latestListener !== null) {
            window.removeEventListener('message', this.latestListener);
        }
        this.latestListener = (e: MessageEvent) => this.handleExecutionEvents(e, request);
        window.addEventListener('message', this.latestListener);
        // Setup iframe listeners
        this.iframe.contentWindow.postMessage({
            'type': 'debug',
            'contents': this.isDebugMode()
        }, '*');
        this.iframe.contentWindow.postMessage({
            'type': 'execute',
            'code': request.assembled,
        }, '*');
        // Change the button to a stop button
        this.setupTerminateButton();
    }

    terminateExecution() {
        if (this.iframe) {
            this.iframe.contentWindow.postMessage({
                'type': 'terminate'
            }, '*');
        }
    }

    setupTerminateButton() {
        $(".kettle-eval-button").off('click.run').on('click.run', () => {
            this.terminateExecution();
            this.handleExecutionStopped("Terminated by user");
        }).removeClass("btn-success").addClass("btn-danger").text("Stop");
        $(".kettle-run-button").prop('disabled', true);
        $("#kettle-execution-control").removeClass("btn-success").addClass("btn-danger");
    }

    restoreRunButtons() {
        $(".kettle-eval-button").off('click.run').on('click.run', () => {
            this.evaluateCode(true);
        }).removeClass("btn-danger").addClass("btn-success").text(this.runText());
        $(".kettle-run-button").off('click.run').on('click.run', () => {
            this.evaluateCode(false);
        }).prop('disabled', false);
        $("#kettle-execution-control").removeClass("btn-danger").addClass("btn-success");
    }

    async evaluateCodeR(instructor: boolean = true) {
        const currentCode = this.submission().code();
        if (this.webR) {
            this.updateStatus("Running", false)
            // @ts-ignore
            let shelter = await new this.webR.Shelter();

            try {
                // @ts-ignore
                let result = await shelter.captureR(currentCode);
                this.updateStatus("Outputing", false)
                console.log(result);
                let output = result.output;

                output.forEach((line) => {
                    if (line.type === 'stdout') {
                        this.console.log(line.data);
                    } else if (line.type === 'stderr') {
                        this.console.error(line.data);
                    } else {
                        this.console.error("Unknown output type", line);
                    }
                });
            } catch (e) {
                this.console.error("Error running R code:", e);
            } finally {
                shelter.purge();
            }
            this.handleExecutionStopped("Finished Execution");
        } else {
            this.console.error("R is not available because WebR failed to load. Please notify the instructor.");
        }
    }

    evaluateCode(instructor: boolean = true) {
        this.console.clear(false);
        this.console.info("Running and evaluating your code");
        this.handleExecutionStarted();
        this.updateStatus("Compiling");
        this.logCompilation();
        if (this.language() === KettleLanguages.R) {
            return this.evaluateCodeR(instructor);
        }
        const request = makeExecutionRequest(this.submission().code(),
            instructor ? this.poolTests()
                : false);
        if (request.noErrors) {
            this.updateStatus("Starting execution");
            this.executeRequest(request);
            this.updateStatus("Running", false)
        } else {
            console.error("Compilation Errors", request);
            if (request.instructor.errors.length > 0 && request.student.errors.length > 0) {
                this.updateFeedback("There were TypeScript errors in your and the instructor code. The program could not be executed. See the console for more information, and notify the instructor.");
                this.logTypeScriptErrors(request.instructor, "Instructor");
                this.logTypeScriptErrors(request.student);
            } else {
                if (request.instructor.errors.length > 0) {
                    this.updateFeedback("There were TypeScript error(s) in the instructor code. Please notify the instructor.");
                    this.logTypeScriptErrors(request.instructor, "Instructor");
                }
                if (request.student.errors.length > 0) {
                    this.updateFeedback("There were TypeScript error(s) in your code. The program could not be executed. See the console for more information.");
                    this.logTypeScriptErrors(request.student);
                }
            }
            this.handleExecutionStopped("Typescript Error");
        }
    }

    loadExecutionEngine(assignmentId: number) {
        if (assignmentId != null) {
            let BlockPyServer = window['$MAIN_BLOCKPY_EDITOR'].components.server;
            let data = BlockPyServer.createServerData();
            data["assignment_id"] = assignmentId;
            BlockPyServer._postBlocking("loadAssignment", data, 4,
                (response: any) => {
                    if (response.success) {
                        let assignment = this.server.assignmentStore.newInstance(response.assignment);
                        this.resetAssignmentIfNeeded(assignment, false);
                        let submission = response.submission ? this.server.submissionStore.newInstance(response.submission) : null;
                        this.assignment(assignment);
                        this.submission(submission);
                        this.parseAdditionalSettings();
                        this.latestTestScore(this.submission().score());
                        this.startEditor();
                        console.log(assignment, this.assignment());
                    } else {
                        console.error("Failed to load", response);
                        this.assignment(null);
                    }
                },
                (e: any, textStatus: string, errorThrown: any) => {
                    console.error("Failed to load (HTTP LEVEL)", e, textStatus, errorThrown);
                    this.assignment(null);
                });
        } else {
            this.assignment(null);
        }
    }

    resetAssignmentIfNeeded(assignment: Assignment, force = true) {
        if (assignment == null) {
            assignment = this.assignment();
        }
        if (force || assignment.onRun() === "") {
            assignment.onRun(BASIC_INSTRUCTOR_CODE);
        }
    }

    parseAdditionalSettings() {
        let settingsRaw = this.assignment().settings();
        let settings = JSON.parse(settingsRaw || "{}");
        if (settings.poolRandomness) {
            this.poolRandomness(settings.poolRandomness);
        } else {
            this.poolRandomness(QuizPoolRandomness.NONE);
        }
    }

    dispose() {
        super.dispose();
        this.subscriptions.currentAssignmentId.dispose();
        this.subscriptions.code.dispose();
        this.subscriptions.submission.dispose();
        this.executionTimer.reset();
        this.console = null;
        this.terminateExecution();
        this.iframe = null;
        clearInterval(this.timeClock);
        if (this.latestListener !== null) {
            window.removeEventListener('message', this.latestListener);
            this.latestListener = null;
        }
        if (this.webR) {
            // @ts-ignore
            this.webR.destroy();
        }
    }

    saveStudentAnswer() {
        this.markDirty();
        if (this.throttleSaving === null) {
            clearTimeout(this.throttleSaving);
        }
        this.throttleSaving = setTimeout(() => this.finishSaveStudentAnswer(), this.SAVE_DELAY);
    }

    finishSaveStudentAnswer() {
        this.saveFile("answer.py", this.submission().code(), false, ()=>{
            this.markClean();
        });
    }

    saveAssignment() {
        const anyError = (e: any, textStatus: string, errorThrown: any) => {
            console.error("Failed to load (HTTP LEVEL)", e, textStatus, errorThrown);
            this.errorMessage("Save Assignment: Failed to load (HTTP LEVEL)" + e);
        };
        const anyReturn = (data: any) => {
            if (!data.success) {
                console.error("Failed to save assignment", data);
                this.errorMessage("Save Assignment: Failed to save (Logic LEVEL)" + JSON.stringify(data));
            }
        }
        this.saveFile("!instructions.md", this.assignment().instructions(), true, anyReturn, anyError);
        this.saveFile("!on_run.py", this.assignment().onRun(), true, anyReturn, anyError);
        this.saveFile("^starting_code.py", this.assignment().startingCode(), true, anyReturn, anyError);
        this.saveAssignmentSettings({
            settings: this.assignment().settings(),
            points: this.assignment().points(),
            url: this.assignment().url(),
            name: this.assignment().name()
        });
    }

    markDirty() {
        this.isDirty(true);
    }

    markClean() {
        this.isDirty(false);
    }

    saveSubmissionRaw() {
        this.saveFile("answer.py", this.submission().code(), true, ()=>{});
    }

    resetStudent() {
        if (confirm("Are you sure you want to reset your code to the starter code? You will lose your current code, and you may not be able to get it back!")) {
            this.submission().code(this.assignment().startingCode());
            this.logEvent("X-File.Reset", "kettle", "code_reset",
                JSON.stringify({
                    "code": this.assignment().startingCode()
                }), this.assignment().url(), () => {})
        }
    }

    resetScore() {
        if (confirm("Are you sure you want to reset your score back to 0?")) {
            this.submission().score(0);
            this.latestTestScore(0);
            this.logEvent("X-File.Reset", "kettle", "score_reset",
                JSON.stringify({
                    "score": 0
                }), this.assignment().url(), () => {})
        }
    }


    submit(score: number, callback: any) {
        let BlockPyServer = window['$MAIN_BLOCKPY_EDITOR'].components.server;
        let now = new Date();
        let data = {
            assignment_id: this.assignment().id,
            assignment_group_id: this.assignmentGroupId,
            course_id: this.courseId,
            submission_id: this.submission().id,
            user_id: this.user.id,
            status: 0, // TODO: What is this status field?
            score: score || 0,
            correct: score >= 1,
            timestamp: now.getTime(),
            timezone: now.getTimezoneOffset(),
            passcode: window['$MAIN_BLOCKPY_EDITOR'].model.display.passcode(),
        };
        return BlockPyServer._postBlocking("updateSubmission", data, 3,
               (response: any) => {
                    //console.log(response.message.feedbacks);
                    if (response.success || response.message.message === "Generic LTI Failure - perhaps not logged into LTI session?") {
                        this.debugLog(response);
                    }
                    if (!response.success) {
                        console.error(response);
                        this.errorMessage(response.message.message);
                    }
                    this.submission().submissionStatus(response.submission_status);
                    this.submission().score(Math.round(score*100));
                    this.submission().correct(score >= 1);
                    if (response.correct) {
                        this.markCorrect(this.assignment().id);
                    }
                    callback();
               },
               (e: any, textStatus: string, errorThrown: any) => {
                    console.error("Failed to load (HTTP LEVEL)", e, textStatus, errorThrown);
                    this.errorMessage("HTTP ERROR (try reloading the page; if still an error, report to instructor!): "+ textStatus+"\n"+errorThrown);
                    callback();
                });
    }
}

export const EDITOR_HTML = `
<!-- Errors -->
<div class="alert alert-warning p-1 border rounded" 
    data-bind="text: errorMessage, visible: errorMessage().length,
                class: {'float-right': !smallLayout()} "></div>

<!-- Instructor Editor Mode Selector -->
<div data-bind="if: isInstructor() && !smallLayout()">
    <!-- Instructor Editor Mode Selector -->
    <div class="btn-group-toggle mt-2 mb-2">
        <label class="btn btn-outline-secondary" for="kettle-editor-mode-radio-submission"
            data-bind="css: { active: editorMode()=='SUBMISSION'}">
            <input data-bind="checked: editorMode"
               id="kettle-editor-mode-radio-submission" name="kettle-editor-mode-radio"
               class="btn-check" type="radio" value="SUBMISSION" autocomplete="off">
            Student Code Editor
        </label>
        <label class="btn btn-outline-secondary mr-4" for="kettle-editor-mode-radio-form"
            data-bind="css: { active: editorMode()=='FORM'}">
            <input data-bind="checked: editorMode"
                       id="kettle-editor-mode-radio-form" name="kettle-editor-mode-radio"
                       class="btn-check" type="radio" value="FORM" autocomplete="off">
            Instructor Editor
        </label>
        <label class="btn btn-outline-secondary mr-4" for="kettle-editor-mode-radio-raw"
            data-bind="css: { active: editorMode()=='RAW'}">
            <input data-bind="checked: editorMode"
                   id="kettle-editor-mode-radio-raw" name="kettle-editor-mode-radio"
                   class="btn-check" type="radio" value="RAW" autocomplete="off">
            Raw Editor
        </label>
        <br><hr>
    </div>
    
    <!-- Raw Instructor Editor -->
    <div data-bind="if: editorMode() === 'RAW'">
        <button data-bind="click: saveAssignment">Save Assignment</button><br>
        <h6>Instructions</h6>
        <textarea data-bind="textInput: assignment().instructions" style="width: 100%; height: 300px"></textarea><br>
        <h6>On Run (Feedback Code)</h6>
        <textarea data-bind="textInput: assignment().onRun" style="width: 100%; height: 300px"></textarea><br>
        <h6>Settings</h6>
        <textarea data-bind="textInput: assignment().settings" style="width: 100%; height: 300px"></textarea><br>
        <h6>Submission</h6>
        <!-- ko if: submission -->
            <textarea data-bind="textInput: submission().code" style="width: 100%; height: 300px"></textarea><br>
            <button data-bind="click: saveSubmissionRaw">Save code changes</button>
        <!-- /ko -->
    </div>

    <!-- Form Instructor Editor -->
    <div data-bind="if: editorMode() === 'FORM'">
        <button data-bind="click: saveAssignment" class="btn btn-info">Save Assignment Changes</button><br>
        <!-- On Run -->
        <h6>Instructor Feedback (On Run) Code</h6>
        <div data-bind="codemirror: {value: assignment().onRun, lineNumbers: true, matchBrackets: true, mode: mimeLanguage}" style="width: 100%; height: 300px"></div><br>
        <button data-bind="click: ()=>resetAssignmentIfNeeded()">Reset On Run</button>
        <!-- Starting Code -->
        <h6>Starting Student Code</h6>
        <div data-bind="codemirror: {value: assignment().startingCode, lineNumbers: true, matchBrackets: true, mode: mimeLanguage}" style="width: 100%; height: 300px"></div><br>
        <!-- Instructions -->
        <h6>Instructions (Body)</h6>
        <textarea data-bind="markdowneditor: {value: assignment().instructions}" style="width: 100%; height: 300px"></textarea><br>
        <!-- Other settings -->
        <div class="form-group">
            <label for="kettle-points-editor">
                Points:
                <input type="number" id="kettle-points-editor" name="kettle-points-editor"
                    class="form-control" data-bind="value: assignment().points">
            </label>
        </div>
        <div class="form-group">
            <label for="kettle-name-editor">
                Name:
                <input type="text" id="kettle-name-editor" name="kettle-name-editor"
                    class="form-control" data-bind="value: assignment().name">
            </label>
        </div>
        <div class="form-group">
            <label for="kettle-url-editor">
                URL:
                <input type="text" id="kettle-url-editor" name="kettle-url-editor"
                    class="form-control" data-bind="value: assignment().url">
            </label>
        </div>
        <h6>Additional Settings</h6>
        <div data-bind="jsoneditor: {value: assignment().settings}" style="width: 100%; height: 300px"></div><br>
        <h6>Assignment Files</h6>
        <div data-bind="filepond: {server: server, submission: submission, assignment: assignment}"></div><br>
    </div>
</div>
`;


export const KETTLE_HTML = `
<div><style>.kettle-student-editor .CodeMirror { resize: vertical} </style>
    ${EDITOR_HTML}
    <!-- ko if: assignment() && !smallLayout() -->
    <div data-bind="markdowned: {value: poolInstructions()}"></div>
    <div data-bind="visible: isInstructor">
        <div class="form-group">
            <label for="kettle-seed-editor">
                Current Seed:
                <input type="text" id="kettle-seed-editor" name="kettle-seed-editor"
                    class="form-control" data-bind="value: seed">
            </label>
        </div>
    </div>
    <!-- /ko -->
    <!-- Body -->
     <div id='ide'>
        <div id='source' style='height: 70%;'></div>
        <div class="btn-group m-2" role="group" aria-label="Execution Control Buttons" >
          <button class='btn btn-success kettle-eval-button' type="button"
                data-bind="text: runText"></button>
        
          <div class="btn-group" role="group">
            <button id="kettle-execution-control" type="button" 
                class="btn btn-success dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"
                data-bind="">
              
            </button>
            <div class="dropdown-menu" aria-labelledby="kettle-execution-control">
              <button class='btn btn-mini btn-success kettle-run-button' data-bind="">Run without grading</button>
            </div>
          </div>
      </div>
      
      <div class="spinner-loader kettle-working-spinner" role="status" style="display: inline-block;">
        <span class="sr-only">Loading...</span>
      </div>
      <span class="kettle-status"></span>
      <span class="kettle-clock"></span>
      <span class="time-clock float-right" data-bind="text: currentTime"></span>
      <!-- Allow instructors to expand out of small layout -->
      <button class="btn btn-outline-secondary btn-sm float-right mr-3" 
        data-bind="click: ()=>smallLayout(!smallLayout()),
                   visible: isInstructor() && startedSmallLayout">Toggle Small Layout</button>

      <button class="btn btn-mini btn-xs btn-outline-secondary code-reset float-right mr-3" data-bind="click: resetStudent">Reset Code</button>
      <span class="float-right mr-3" data-bind="visible: isInstructor, click: resetScore">Score: <span data-bind="text: latestTestScore"></span></span>
      <!-- ko if: isDirty() -->
        <small class="alert alert-info p-1 border rounded float-right">Saving changes</small>
      <!-- /ko -->
      </div>
      <!-- ko if: smallLayout() -->
        <iframe src="../blockpy/serve_kettle_iframe" class="kettle-execution-iframe" style="display: none;"></iframe>
        <div class="row mb-2" style="background-color: #fcf8e3; border: 1px solid #faebcc">
            <div class="col-md-5">
                <button class="btn btn-mini btn-xs btn-outline-secondary float-right mr-3" style="display: none;" id="abort-command">Stop Execution</button>
                <h6>Console (log)</h6>
                
                <div class='kettle-console' style="resize: vertical; height: 200px; overflow: auto; scroll-behavior: smooth"></div>
                <h6>Instructor Feedback</h6>
                <div class="kettle-feedback" style="min-height: 100px; padding: 4px"></div>
            </div>
            <div class="col-md-7">
                <!-- ko if: submission -->
                <div data-bind="codemirror: {
                    value: submission().code, lineNumbers: true, 
                    matchBrackets: true, mode: mimeLanguage,
                    indentUnit: 4,
                    statementIndent: 4, noOverwrite: true,
                }" style="width: 100%; border: 1px solid black;" 
                    class="kettle-student-editor"></div>
              <!-- /ko -->
            </div>
        </div>
      <!-- /ko -->
      <!-- ko ifnot: smallLayout() -->
          <!-- ko if: submission -->
            <div data-bind="codemirror: {
                value: submission().code, lineNumbers: true, 
                matchBrackets: true, mode: mimeLanguage,
                indentUnit: 4,
                statementIndent: 4, noOverwrite: true,
            }" style="width: 100%; border: 1px solid black;" class="kettle-student-editor"></div>
            <br>
          <!-- /ko -->
          <iframe src="../blockpy/serve_kettle_iframe" class="kettle-execution-iframe" style="display: none;"></iframe>
          <div class="row mb-2">
            <div class="col-md-7">
                <button class="btn btn-mini btn-xs btn-outline-secondary float-right mr-3" style="display: none;" id="abort-command">Stop Execution</button>
                <h6>Console (log)</h6>
                
                <div class='kettle-console' style="resize: vertical; height: 300px; overflow: auto; scroll-behavior: smooth"></div>
            </div>
            <div class="col-md-5">
                <h6>Instructor Feedback</h6>
                <div class="kettle-feedback" style="min-height: 300px; padding: 4px"></div>
            </div>
          </div>
      <!-- /ko -->
</div>
`

ko.components.register("kettle", {
    viewModel: Kettle,
    template: KETTLE_HTML
});
