/**
 * Quiz Editor State
 *
 * Observable ViewModels for the visual quiz editor. Instructors interact with
 * these classes instead of editing raw JSON.
 *
 * The quiz data lives in two separate JSON blobs:
 *   - instructions  (assignment.instructions) — what students see
 *   - checks        (assignment.onRun)        — answer keys / feedback logic
 *
 * Both are parsed into observable state here, and can be serialised back via
 * toInstructionsJson() / toChecksJson().
 */

import * as ko from 'knockout';
import {
    QuizFeedbackType,
    QuizInstructions,
    QuizInstructionsSettings,
    QuizPoolRandomness,
    QuestionPool,
    fillInMissingQuizInstructionFields
} from './quiz';
import {QuizQuestionTypes} from './questions';

// ---------------------------------------------------------------------------
// Small helper types
// ---------------------------------------------------------------------------

/** A key→value pair used when editing dictionaries as arrays in the UI. */
export class KeyValuePair {
    key: ko.Observable<string>;
    value: ko.Observable<string>;
    constructor(key: string, value: string) {
        this.key = ko.observable(key);
        this.value = ko.observable(value);
    }
}

/** A single answer option used by MCQ / MAQ / Matching. */
export class AnswerOption {
    text: ko.Observable<string>;
    constructor(text: string) {
        this.text = ko.observable(text);
    }
}

/** A blank used by multiple_dropdowns / fill_in_multiple_blanks. */
export class BlankEntry {
    /** The identifier that appears in the body text, e.g. [color] → "color". */
    key: ko.Observable<string>;
    /** Possible answers for this blank (dropdown options). */
    options: ko.ObservableArray<AnswerOption>;
    /** Correct answer for this blank. */
    correctAnswer: ko.Observable<string>;
    /** Correct answers as a newline-separated list (for fill_in blanks). */
    correctList: ko.Observable<string>;

    constructor(key: string, options: string[] = [], correctAnswer: string = '',
                correctList: string[] = []) {
        this.key = ko.observable(key);
        this.options = ko.observableArray(options.map(o => new AnswerOption(o)));
        this.correctAnswer = ko.observable(correctAnswer);
        this.correctList = ko.observable(correctList.join('\n'));
    }

    addOption() { this.options.push(new AnswerOption('')); }
    removeOption(opt: AnswerOption) { this.options.remove(opt); }
}

/** A single feedback entry: answer → message. */
export class FeedbackEntry {
    answer: ko.Observable<string>;
    message: ko.Observable<string>;
    constructor(answer: string, message: string) {
        this.answer = ko.observable(answer);
        this.message = ko.observable(message);
    }
}

// ---------------------------------------------------------------------------
// Quiz Settings
// ---------------------------------------------------------------------------

export class QuizEditorSettings {
    feedbackType: ko.Observable<string>;
    attemptLimit: ko.Observable<number>;
    coolDown: ko.Observable<number>;
    poolRandomness: ko.Observable<string>;
    readingId: ko.Observable<string>;
    feedbackId: ko.Observable<string>;

    constructor(settings: QuizInstructionsSettings) {
        this.feedbackType = ko.observable(settings.feedbackType || QuizFeedbackType.IMMEDIATE);
        this.attemptLimit = ko.observable(settings.attemptLimit ?? -1);
        this.coolDown = ko.observable(settings.coolDown ?? -1);
        this.poolRandomness = ko.observable(settings.poolRandomness || QuizPoolRandomness.SEED);
        // readingId/feedbackId can be a number or a URL string; keep as string for the input
        this.readingId = ko.observable(
            settings.readingId != null ? String(settings.readingId) : ''
        );
        this.feedbackId = ko.observable(
            settings.feedbackId != null ? String(settings.feedbackId) : ''
        );
    }

    /** Parse an ID input: empty → null, numeric → number, otherwise the URL string. */
    private static parseIdField(raw: string): number | string | null {
        const trimmed = raw.trim();
        if (trimmed === '') {
            return null;
        }
        const n = Number(trimmed);
        return isNaN(n) ? trimmed : n;
    }

    toJson(): QuizInstructionsSettings {
        return {
            feedbackType: this.feedbackType() as QuizFeedbackType,
            attemptLimit: Number(this.attemptLimit()),
            coolDown: Number(this.coolDown()),
            poolRandomness: this.poolRandomness() as QuizPoolRandomness,
            readingId: QuizEditorSettings.parseIdField(this.readingId()),
            feedbackId: QuizEditorSettings.parseIdField(this.feedbackId()),
        };
    }
}

// ---------------------------------------------------------------------------
// Question Pool
// ---------------------------------------------------------------------------

export class QuizEditorPool {
    name: ko.Observable<string>;
    amount: ko.Observable<number>;
    /** Each element is the question ID string. */
    questions: ko.ObservableArray<ko.Observable<string>>;

    constructor(pool: QuestionPool) {
        this.name = ko.observable(pool.name || '');
        this.amount = ko.observable(pool.amount ?? 1);
        this.questions = ko.observableArray(pool.questions.map(q => ko.observable(q)));
    }

    addQuestion() { this.questions.push(ko.observable('')); }
    removeQuestion(q: ko.Observable<string>) { this.questions.remove(q); }

    toJson(): QuestionPool {
        return {
            name: this.name(),
            amount: Number(this.amount()),
            questions: this.questions().map(q => q()),
        };
    }
}

// ---------------------------------------------------------------------------
// Quiz Editor Question (instructions + checks combined)
// ---------------------------------------------------------------------------

export const QUESTION_TYPE_LABELS: {[k: string]: string} = {
    true_false_question: 'True / False',
    multiple_choice_question: 'Multiple Choice',
    multiple_answers_question: 'Multiple Answers (checkboxes)',
    matching_question: 'Matching',
    multiple_dropdowns_question: 'Multiple Dropdowns',
    fill_in_multiple_blanks_question: 'Fill In Multiple Blanks',
    short_answer_question: 'Short Answer',
    numerical_question: 'Numerical',
    essay_question: 'Essay',
    text_only_question: 'Text Only',
};

export class QuizEditorQuestion {
    // ── Instruction fields ────────────────────────────────────────────────
    id: ko.Observable<string>;
    type: ko.Observable<string>;
    body: ko.Observable<string>;
    points: ko.Observable<number>;
    retainOrder: ko.Observable<boolean>;

    /** MCQ / MAQ / Matching: list of answer options */
    answers: ko.ObservableArray<AnswerOption>;
    /** Matching: list of statement texts (left-hand side) */
    statements: ko.ObservableArray<AnswerOption>;
    /** multiple_dropdowns: one BlankEntry per [identifier] in the body */
    mdBlanks: ko.ObservableArray<BlankEntry>;

    // ── Check fields ──────────────────────────────────────────────────────
    // true_false
    tf_correct: ko.Observable<string>;      // "true" | "false"
    tf_wrong: ko.Observable<string>;

    // multiple_choice
    mc_correct: ko.Observable<string>;
    mc_wrong_any: ko.Observable<string>;
    mc_feedback: ko.ObservableArray<FeedbackEntry>;

    // multiple_answers
    /** IDs (by index) of answers that are correct; parallel to this.answers */
    ma_correct: ko.ObservableArray<boolean>;
    ma_wrong_any: ko.Observable<string>;

    // matching
    /** correct answer per statement, parallel to this.statements */
    mat_correct: ko.ObservableArray<ko.Observable<string>>;

    // multiple_dropdowns — correct is stored inside mdBlanks[].correctAnswer

    md_wrong_any: ko.Observable<string>;

    // short_answer / numerical
    sa_check_type: ko.Observable<string>;   // 'exact' | 'regex'
    /** Newline-separated list of acceptable exact answers */
    sa_correct_exact: ko.Observable<string>;
    /** Newline-separated list of regex patterns */
    sa_correct_regex: ko.Observable<string>;
    sa_wrong_any: ko.Observable<string>;
    sa_feedback: ko.ObservableArray<FeedbackEntry>;

    // fill_in_multiple_blanks — blanks stored in fimbBlanks
    fimbBlanks: ko.ObservableArray<BlankEntry>;
    fimb_check_type: ko.Observable<string>; // 'exact' | 'regex'
    fimb_wrong_any: ko.Observable<string>;

    // ── UI state ──────────────────────────────────────────────────────────
    expanded: ko.Observable<boolean>;

    constructor(id: string, question: any, check: any) {
        check = check || {};

        // ── Instructions ────────────────────────────────────────────────
        this.id = ko.observable(id);
        this.type = ko.observable(question.type || QuizQuestionTypes.true_false_question);
        this.body = ko.observable(question.body || '');
        this.points = ko.observable(question.points ?? 1);
        this.retainOrder = ko.observable(question.retainOrder ?? false);

        // answers / statements
        const rawAnswers: string[] = Array.isArray(question.answers) ? question.answers : [];
        this.answers = ko.observableArray(rawAnswers.map(a => new AnswerOption(a)));

        const rawStatements: string[] = Array.isArray(question.statements) ? question.statements : [];
        this.statements = ko.observableArray(rawStatements.map(s => new AnswerOption(s)));

        // multiple_dropdowns blanks
        const rawMdAnswers: {[key: string]: string[]} =
            (!Array.isArray(question.answers) && typeof question.answers === 'object')
                ? question.answers || {}
                : {};
        const mdCorrect: {[key: string]: string} = check.correct || {};
        this.mdBlanks = ko.observableArray(
            Object.entries(rawMdAnswers).map(([k, opts]) =>
                new BlankEntry(k, opts, mdCorrect[k] || '')
            )
        );

        // fill_in blanks — extract blanks from the body on construction
        const rawFimbCorrect: {[key: string]: string|string[]} =
            check.correct || check.correct_exact || {};
        const rawFimbRegex: {[key: string]: string[]} = check.correct_regex || {};
        const fimbCheckType = check.correct_regex ? 'regex' : 'exact';
        const bodyBlanks = extractBracketed(question.body || '');
        this.fimbBlanks = ko.observableArray(bodyBlanks.map(key => {
            const correctVal = rawFimbCorrect[key];
            const correctList = Array.isArray(correctVal)
                ? correctVal
                : (correctVal ? [correctVal] : []);
            const regexList: string[] = rawFimbRegex[key] || [];
            const combined = fimbCheckType === 'regex' ? regexList : correctList;
            return new BlankEntry(key, [], '', combined);
        }));
        this.fimb_check_type = ko.observable(fimbCheckType);
        this.fimb_wrong_any = ko.observable(check.wrong_any || '');

        // ── Checks ──────────────────────────────────────────────────────

        // true_false
        const rawTfCorrect = check.correct;
        this.tf_correct = ko.observable(
            rawTfCorrect === true || rawTfCorrect === 'true' ? 'true' : 'false'
        );
        this.tf_wrong = ko.observable(check.wrong || '');

        // multiple_choice
        const rawMcCorrect = check.correct;
        this.mc_correct = ko.observable(
            Array.isArray(rawMcCorrect) ? rawMcCorrect[0] || '' : (rawMcCorrect || '')
        );
        this.mc_wrong_any = ko.observable(check.wrong_any || '');
        const rawMcFeedback: {[k: string]: string} = check.feedback || {};
        this.mc_feedback = ko.observableArray(
            Object.entries(rawMcFeedback).map(([a, m]) => new FeedbackEntry(a, m))
        );

        // multiple_answers
        const rawMaCorrect: string[] = Array.isArray(check.correct) ? check.correct : [];
        this.ma_correct = ko.observableArray(
            rawAnswers.map(a => rawMaCorrect.includes(a))
        );
        this.ma_wrong_any = ko.observable(check.wrong_any || '');

        // matching
        const rawMatCorrect: (string|string[])[] = Array.isArray(check.correct) ? check.correct : [];
        this.mat_correct = ko.observableArray(
            rawStatements.map((_, i) => {
                const c = rawMatCorrect[i];
                return ko.observable(Array.isArray(c) ? c.join('\n') : (c || ''));
            })
        );

        // multiple_dropdowns: stored in mdBlanks.correctAnswer already

        this.md_wrong_any = ko.observable(check.wrong_any || '');

        // short_answer / numerical
        const saCheckType = check.correct_regex ? 'regex' : 'exact';
        this.sa_check_type = ko.observable(saCheckType);
        const saExact = check.correct || check.correct_exact;
        this.sa_correct_exact = ko.observable(
            Array.isArray(saExact) ? saExact.join('\n') : (saExact || '')
        );
        const saRegex: string[] = check.correct_regex || [];
        this.sa_correct_regex = ko.observable(saRegex.join('\n'));
        this.sa_wrong_any = ko.observable(check.wrong_any || '');
        const rawSaFeedback: {[k: string]: string} = check.feedback || {};
        this.sa_feedback = ko.observableArray(
            Object.entries(rawSaFeedback).map(([a, m]) => new FeedbackEntry(a, m))
        );

        // UI
        this.expanded = ko.observable(false);

        // Derived: when answers list changes, keep ma_correct in sync
        this.answers.subscribe((newAnswers: AnswerOption[]) => {
            const currentCorrect = this.getMultipleAnswersCorrectSet();
            this.ma_correct(newAnswers.map(a => currentCorrect.has(a.text())));
        });

        // Derived: when statements list changes, keep mat_correct in sync
        this.statements.subscribe((newStatements: AnswerOption[]) => {
            const current = this.mat_correct();
            const padded = newStatements.map((_, i) =>
                current[i] || ko.observable('')
            );
            this.mat_correct(padded);
        });
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    toggleExpanded() { this.expanded(!this.expanded()); }

    // --- Answers management -------------------------------------------------
    addAnswer() { this.answers.push(new AnswerOption('')); }
    removeAnswer(a: AnswerOption) {
        const idx = this.answers.indexOf(a);
        this.answers.remove(a);
        if (idx >= 0) { this.ma_correct.splice(idx, 1); }
    }

    // --- Statements management ----------------------------------------------
    addStatement() {
        this.statements.push(new AnswerOption(''));
        this.mat_correct.push(ko.observable(''));
    }
    removeStatement(s: AnswerOption) {
        const idx = this.statements.indexOf(s);
        this.statements.remove(s);
        if (idx >= 0) { this.mat_correct.splice(idx, 1); }
    }

    // --- Multiple dropdowns blank management --------------------------------
    addMdBlank() { this.mdBlanks.push(new BlankEntry('', [], '')); }
    removeMdBlank(b: BlankEntry) { this.mdBlanks.remove(b); }

    // --- Fill-in blanks management ------------------------------------------
    rebuildFimbBlanks() {
        const existing: {[k: string]: BlankEntry} = {};
        this.fimbBlanks().forEach(b => { existing[b.key()] = b; });
        const keys = extractBracketed(this.body());
        this.fimbBlanks(keys.map(k => existing[k] || new BlankEntry(k, [], '')));
    }

    // --- Multiple choice feedback -------------------------------------------
    addMcFeedback() { this.mc_feedback.push(new FeedbackEntry('', '')); }
    removeMcFeedback(f: FeedbackEntry) { this.mc_feedback.remove(f); }

    // --- Short answer feedback -----------------------------------------------
    addSaFeedback() { this.sa_feedback.push(new FeedbackEntry('', '')); }
    removeSaFeedback(f: FeedbackEntry) { this.sa_feedback.remove(f); }

    // ── Serialisation ──────────────────────────────────────────────────────

    private getMultipleAnswersCorrectSet(): Set<string> {
        const s = new Set<string>();
        this.answers().forEach((a, i) => {
            if (this.ma_correct()[i]) { s.add(a.text()); }
        });
        return s;
    }

    toInstructionsJson(): {[key: string]: any} {
        const type = this.type();
        const base: {[key: string]: any} = {
            type,
            body: this.body(),
            points: Number(this.points()),
        };

        if (type === QuizQuestionTypes.matching_question
            || type === QuizQuestionTypes.multiple_dropdowns_question) {
            base.retainOrder = this.retainOrder();
        }

        if (type === QuizQuestionTypes.matching_question) {
            base.answers = this.answers().map(a => a.text());
            base.statements = this.statements().map(s => s.text());
        } else if (type === QuizQuestionTypes.multiple_choice_question
            || type === QuizQuestionTypes.multiple_answers_question) {
            base.answers = this.answers().map(a => a.text());
        } else if (type === QuizQuestionTypes.multiple_dropdowns_question) {
            const ans: {[k: string]: string[]} = {};
            this.mdBlanks().forEach(b => {
                ans[b.key()] = b.options().map(o => o.text());
            });
            base.answers = ans;
        }
        // fill_in, short_answer, numerical, essay, text_only, true_false:
        // no 'answers' field in instructions

        return base;
    }

    toChecksJson(): {[key: string]: any} {
        const type = this.type();
        const check: {[key: string]: any} = {};

        switch (type) {
            case QuizQuestionTypes.true_false_question:
                check.correct = this.tf_correct() === 'true';
                if (this.tf_wrong().trim()) { check.wrong = this.tf_wrong().trim(); }
                break;

            case QuizQuestionTypes.multiple_choice_question: {
                check.correct = this.mc_correct();
                if (this.mc_wrong_any().trim()) { check.wrong_any = this.mc_wrong_any().trim(); }
                const fb: {[k: string]: string} = {};
                this.mc_feedback().forEach(f => {
                    if (f.answer().trim()) { fb[f.answer().trim()] = f.message(); }
                });
                if (Object.keys(fb).length) { check.feedback = fb; }
                break;
            }

            case QuizQuestionTypes.multiple_answers_question: {
                const correctAnswers = this.answers()
                    .filter((_, i) => this.ma_correct()[i])
                    .map(a => a.text());
                check.correct = correctAnswers;
                if (this.ma_wrong_any().trim()) { check.wrong_any = this.ma_wrong_any().trim(); }
                break;
            }

            case QuizQuestionTypes.matching_question: {
                check.correct = this.mat_correct().map(c => {
                    const v = c();
                    // If there are multiple lines treat as a list of acceptable answers
                    const lines = v.split('\n').map(l => l.trim()).filter(Boolean);
                    return lines.length === 1 ? lines[0] : lines;
                });
                break;
            }

            case QuizQuestionTypes.multiple_dropdowns_question: {
                const correct: {[k: string]: string} = {};
                this.mdBlanks().forEach(b => { correct[b.key()] = b.correctAnswer(); });
                check.correct = correct;
                if (this.md_wrong_any().trim()) { check.wrong_any = this.md_wrong_any().trim(); }
                break;
            }

            case QuizQuestionTypes.short_answer_question:
            case QuizQuestionTypes.numerical_question: {
                if (this.sa_check_type() === 'regex') {
                    check.correct_regex = this.sa_correct_regex()
                        .split('\n').map(s => s.trim()).filter(Boolean);
                } else {
                    const lines = this.sa_correct_exact()
                        .split('\n').map(s => s.trim()).filter(Boolean);
                    check.correct_exact = lines.length === 1 ? lines[0] : lines;
                }
                if (this.sa_wrong_any().trim()) { check.wrong_any = this.sa_wrong_any().trim(); }
                const fb: {[k: string]: string} = {};
                this.sa_feedback().forEach(f => {
                    if (f.answer().trim()) { fb[f.answer().trim()] = f.message(); }
                });
                if (Object.keys(fb).length) { check.feedback = fb; }
                break;
            }

            case QuizQuestionTypes.fill_in_multiple_blanks_question: {
                if (this.fimb_check_type() === 'regex') {
                    const correct: {[k: string]: string[]} = {};
                    this.fimbBlanks().forEach(b => {
                        correct[b.key()] = b.correctList().split('\n').map(s => s.trim()).filter(Boolean);
                    });
                    check.correct_regex = correct;
                } else {
                    const correct: {[k: string]: string|string[]} = {};
                    this.fimbBlanks().forEach(b => {
                        const lines = b.correctList().split('\n').map(s => s.trim()).filter(Boolean);
                        correct[b.key()] = lines.length === 1 ? lines[0] : lines;
                    });
                    check.correct_exact = correct;
                }
                if (this.fimb_wrong_any().trim()) { check.wrong_any = this.fimb_wrong_any().trim(); }
                break;
            }

            // essay and text_only have no check fields
            default:
                break;
        }

        return check;
    }
}

// ---------------------------------------------------------------------------
// Main QuizEditorState
// ---------------------------------------------------------------------------

export class QuizEditorState {
    settings: QuizEditorSettings;
    questions: ko.ObservableArray<QuizEditorQuestion>;
    pools: ko.ObservableArray<QuizEditorPool>;

    constructor(instructionsJson: string, checksJson: string) {
        let instructions: QuizInstructions;
        try {
            instructions = JSON.parse(instructionsJson || '{}') as QuizInstructions;
        } catch (e) {
            instructions = {};
        }
        fillInMissingQuizInstructionFields(instructions);

        let checks: {questions?: {[id: string]: any}};
        try {
            checks = JSON.parse(checksJson || '{}');
        } catch (e) {
            checks = {};
        }
        const checkQuestions = checks.questions || {};

        this.settings = new QuizEditorSettings(instructions.settings);
        this.pools = ko.observableArray(
            (instructions.pools || []).map(p => new QuizEditorPool(p))
        );
        this.questions = ko.observableArray(
            Object.entries(instructions.questions || {}).map(([id, q]) =>
                new QuizEditorQuestion(id, q, checkQuestions[id] || {})
            )
        );
    }

    addQuestion() {
        const id = `question_${Date.now()}`;
        this.questions.push(new QuizEditorQuestion(id, {type: 'multiple_choice_question', body: '', points: 1}, {}));
    }

    removeQuestion(q: QuizEditorQuestion) {
        if (confirm("Are you sure you want to delete that question?")) {
            this.questions.remove(q);
        }
    }

    addPool() {
        this.pools.push(new QuizEditorPool({name: '', amount: 1, questions: []}));
    }
    removePool(p: QuizEditorPool) { this.pools.remove(p); }

    toInstructionsJson(): string {
        const out: QuizInstructions = {
            settings: this.settings.toJson(),
            pools: this.pools().map(p => p.toJson()),
            questions: {},
        };
        this.questions().forEach(q => {
            // @ts-ignore
            out.questions[q.id()] = q.toInstructionsJson();
        });
        return JSON.stringify(out, null, 2);
    }

    toChecksJson(): string {
        const out: {questions: {[id: string]: any}} = {questions: {}};
        this.questions().forEach(q => {
            const checkData = q.toChecksJson();
            // Only include non-empty check objects
            if (Object.keys(checkData).length > 0) {
                out.questions[q.id()] = checkData;
            }
        });
        return JSON.stringify(out, null, 2);
    }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Extract [identifier] keys from a body string (like getBracketed in questions.ts). */
export function extractBracketed(body: string): string[] {
    const SQUARE_BRACKETS = /(?<!\\)(\[.*?\]\]?)(?!\()/g;
    const result: string[] = [];
    const parts = body.split(SQUARE_BRACKETS);
    parts.forEach(part => {
        if (part.startsWith('[[') && part.endsWith(']]')) return;
        if (part.startsWith('[') && part.endsWith(']')) {
            result.push(part.slice(1, -1));
        }
    });
    return result;
}
