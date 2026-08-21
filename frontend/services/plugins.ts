import * as ko from 'knockout';
import * as CodeMirror from 'codemirror';
import * as hljs from 'highlight.js';
import * as select2 from 'select2';
//import 'select2';
import 'knockout-switch-case';
import * as MarkdownIt from 'markdown-it';
import JSONEditor, {JSONEditorMode} from 'jsoneditor';
import * as FilePond from 'filepond';
import FilePondPluginImagePreview from 'filepond-plugin-image-preview';
import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.css';

import {BlockPyFileRecord} from "../models/files";
import {ajax_get_file} from "./ajax";
import StateCore from "markdown-it/lib/rules_core/state_core";
import Token from "markdown-it/lib/token";
import {AssignmentJson} from "../models/assignment";
import {SubmissionJson} from "../models/submission";
// The CSS for jsoneditor is loaded via assets.py
//import 'jsoneditor/dist/jsoneditor.css';

// Knockout codemirror binding handler
ko.bindingHandlers.codemirror = {
    init: function (element, valueAccessor) {
        let options = ko.unwrap(valueAccessor());
        element.editor = CodeMirror(element, ko.toJS(options));
        console.log(element.editor);
        element.editor.on('change', function (cm: any) {
            const latestOptions = ko.unwrap(valueAccessor());
            if (!latestOptions.readOnly) {
                latestOptions.value(cm.getValue());
            }
        });
        element.editor.setValue(options.value());

        if (options.noOverwrite) {
            element.editor.setOption("extraKeys", {
                Insert: (cm: CodeMirror.Editor) => {
                    cm.toggleOverwrite(false);
                }
            })
        }

        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            let wrapper = element.editor.getWrapperElement();
            wrapper.parentNode.removeChild(wrapper);
        });
    },
    update: function (element, valueAccessor) {
        let value = ko.toJS(valueAccessor()).value;
        if (element.editor) {
            let cur = element.editor.getCursor();
            element.editor.setValue(value);
            element.editor.setCursor(cur);
            element.editor.refresh();
        }
    }
};

// Knockout jsoneditor binding handler
ko.bindingHandlers.jsoneditor = {
    init: function (element, valueAccessor) {
        let initialValue = ko.unwrap(valueAccessor());
        let options =  {
            onChangeText:  function (newValue: any) {
                initialValue = ko.unwrap(valueAccessor());
                element.flag = true;
                initialValue.value(newValue);
            },
            modes: ['tree', 'code', 'text'] as JSONEditorMode[],
            mode: 'code' as JSONEditorMode
        };
        let jsonValue,
            jsonParsed = false,
            rawValue = initialValue.value() || "{}";
        try {
            jsonValue = JSON.parse(rawValue);
            jsonParsed = true;
        } catch (error) {
            console.error(error);
            alert("Error parsing JSON for editor: "+error);
        }
        element.editor = new JSONEditor(element, options);
        if (jsonParsed) {
            element.editor.set(jsonValue);
        } else {
            element.editor.setText(rawValue);
        }

        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            element.editor.destroy();
        });
    },
    update: function (element, valueAccessor) {
        let value = ko.toJS(valueAccessor()).value;
        if (element.flag) {
            element.flag = false;
        } else {
            element.editor.set(JSON.parse(value || "{}"));
        }
    }
};

// Knockout jsoneditor binding handler
ko.bindingHandlers.markdowneditor = {
    init: function (element, valueAccessor) {
        let initialValue = ko.unwrap(valueAccessor());
        // @ts-ignore
        element.editor = new EasyMDE({
            element: element,
            autoDownloadFontAwesome: false,
            forceSync: true,
            minHeight: "500px",
            // TODO: imageUploadFunction
            renderingConfig: {
                codeSyntaxHighlighting: true,
            },
            indentWithTabs: false,
            tabSize: 4,
        });
        //console.log("CREATING EDITOR AGAIN");
        element.editor.codemirror.on("change", (newValue: any) => {
            initialValue = ko.unwrap(valueAccessor());
            //console.log("CHANGE EVENT", element.flag, element.editor.value(), initialValue.value());
            //element.flag = true;
            initialValue.value(element.editor.value());
        })
        element.editor.value(initialValue.value());
        element.flag = false;

        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            //element.editor.cleanup();
            element.editor = null;
        });
    },
    update: function (element, valueAccessor) {
        let value = ko.toJS(valueAccessor()).value;
        //console.log("MDE Update", element, valueAccessor, value, element.flag);
        if (element.flag) {
            element.flag = false;
        } else {
            const cur = element.editor.codemirror.getCursor();
            element.editor.value(value);
            element.editor.codemirror.setCursor(cur);
            //element.editor.refresh();
        }
    }
};

// Highlighted Code Area
hljs.configure({
    languages: ["python", "javascript", "typescript", "r"]
})
ko.bindingHandlers.highlightedCode = {
    update: function (element, valueAccessor) {
        let options = ko.unwrap(valueAccessor());
        // Check if it's an object or a string
        let code, injectPrompt: string;
        if (typeof options === 'object') {
            code = options.value;
            injectPrompt = options.injectPrompt;
        } else {
            code = options;
            injectPrompt = "";
        }
        element.innerHTML = code;
        hljs.highlightBlock(element);
        if (code.trim()) {
            // @ts-ignore
            hljs.lineNumbersBlock(element);
        }
        if (injectPrompt) {
            $(element).find("td[data-line-number='3'].hljs-ln-code").each(function () {
                $(this).append("<span style='font-size: 0; opacity: 0'>"+injectPrompt+"</span>");
            });
        }
    }
};

function replaceAttr(token: Token, attrName: string, replace: any, env: any) {
  token.attrs.forEach(function (attr: [string, string]) {
    if (attr[0] === attrName) {
      attr[1] = replace(attr[1], env, token)
    }
  })
}

function replaceLink(link: string, env: any) {
    return link.startsWith("http") ? link : env.downloadUrl(link);
}

export let md: MarkdownIt = new MarkdownIt({
    html: true,
    highlight: function (str, lang, langAttrs) {
        // For now, the only option is the partId, hopefully folks don't try to get fancy with that.
        const hljsLang = hljs.getLanguage(lang);
        if (lang && hljsLang) {
          if (lang === "python") {
              try {
                  //return hljs.highlight(str, { language: lang }).value;
                  const launchBlockpy = langAttrs ? ` class="reader-launch-blockpy" data-part-id="${langAttrs}"` : "";
                  return `<pre${launchBlockpy} style="margin-bottom: 5px"><code class="language-${lang} hljs">` +
                      // @ts-ignore
                      hljs.highlight(lang, str, true).value +
                      `</code></pre>
                        <div style="display: none">${str}</div>
                        <div data-bind="blockPyEditor: {partId: '${langAttrs}', launched: false,
                                        assignment: ((typeof assignment).localeCompare('undefined')) ? assignment : null,
                                        submission: ((typeof submission).localeCompare('undefined')) ? submission : null}"></div>`;
              } catch (e) {
                  console.error(e);
              }
          } else if (lang === "typescript" || lang === "ts" || lang =="r") {
                try {
                    //return hljs.highlight(str, { language: lang }).value;
                    const launchKettle = langAttrs ? ` class="reader-launch-kettle" data-part-id="${langAttrs}"` : "";
                    return `<pre${launchKettle} style="margin-bottom: 5px"><code class="language-${lang} hljs">` +
                        // @ts-ignore
                        hljs.highlight(lang, str, true).value +
                        `</code></pre>
                        <div style="display: none">${str}</div>
                        <div data-bind="kettleLauncher: {partId: '${langAttrs}', launched: false,
                                        language: '${lang}',
                                        assignment: ((typeof assignment).localeCompare('undefined')) ? assignment : null,
                                        submission: ((typeof submission).localeCompare('undefined')) ? submission : null}"></div>`;
                } catch (e) {
                    console.error(e);
                }
          } else {
              try {
                    //return hljs.highlight(str, { language: lang }).value;
                    return `<pre style="margin-bottom: 5px"><code class="language-${lang} hljs">` +
                        // @ts-ignore
                        hljs.highlight(lang, str, true).value +
                        `</code></pre>`;
                } catch (e) {
                    console.error(e);
                }
          }
        }
        // @ts-ignore
        return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
    }
}).use((md: MarkdownIt) => {
    md.core.ruler.after('inline', 'replace-link', (state: StateCore) => {
        state.tokens.forEach(function (blockToken) {
          if (blockToken.type === 'inline' && blockToken.children) {
            blockToken.children.forEach(function (token) {
              const type = token.type;
              if (type === 'link_open') {
                replaceAttr(token, 'href', replaceLink, state.env)
              } else if (type === 'image') {
                replaceAttr(token, 'src', replaceLink, state.env)
              }
            })
          }
        })
        return false;
    })
});

window.$ALL_BLOCKPY_EDITORS = [];

ko.bindingHandlers.markdowned = {
    'init': function() {
        return { 'controlsDescendantBindings': true };
    },
    update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        let code = ko.unwrap(valueAccessor());
        //console.log(code);
        element.innerHTML = md.render(code.value, code.assignment && code.assignment() ? {
            downloadUrl: (link: string) => window["$URL_ROOT"] + `blockpy/download_file?placement=assignment&directory=${code.assignment().id}&filename=${link}`
        } : {downloadUrl: (link: string) => link});
        //let codeBlocks = element.querySelectorAll("pre code");
        //codeBlocks.forEach((block: HTMLElement) => hljs.highlightBlock(block));
        ko.applyBindingsToDescendants(bindingContext, element);
        //hljs.highlightBlock(element.querySelector("pre code"));
        /*if (code.trim()) {
            hljs.lineNumbersBlock(element.querySelector("pre code"));
        }*/
    }
};

const DEFAULT_SECTION_PATTERN = /^(##### Part (.+))$/gm;

function injectCodePart(existingCode: string, newCode: string, partId: string, overwrite: boolean): string {
    const [header, ...rawParts] = existingCode.split(DEFAULT_SECTION_PATTERN);
    const newBody = header ? [header] : [];
    let found = false;
    for (let i = 0; i < rawParts.length; i+= 3) {
        let [fullPartHeader, candidatePartId, partBody] = rawParts.slice(i, i+3);
        newBody.push(fullPartHeader);
        if (overwrite && candidatePartId === partId) {
            newBody.push(newCode);
            found = true;
        } else {
            if (candidatePartId === partId) {
                found = true;
            }
            if (partBody && partBody[0] === "\n") {
                partBody = partBody.slice(1);
            }
            if (i !== rawParts.length - 3 && partBody && partBody.slice(-1) === "\n") {
                partBody = partBody.slice(0, -1);
            }
            newBody.push(partBody);
        }
    }
    if (!found) {
        newBody.push("##### Part " + partId);
        newBody.push(newCode);
    }
    return newBody.join("\n");
}


function launchBlockPy(element: Node, partId: string, assignment: AssignmentJson, submission: SubmissionJson, initialBody: string) {
    // @ts-ignore
    const newBlockPyEditor = new blockpy.BlockPy({
        'blockly.path': window.$blocklyMediaPath,
        "urls": {
            ...window.$blockPyUrls,
            saveAssignment: undefined,
            updateSubmission: undefined,
            updateSubmissionStatus: undefined
        },
        ...window.$blockPyUserData,
        'attachment.point': element,
        'partId': partId,
        "assignment.settings.small_layout": "true",
        "display.python.mode": "text",
        "submission.code": initialBody
    });
    if (partId) {
        const data = {
            assignment: {... assignment, starting_code: initialBody},
            submission: {... submission,
                code: injectCodePart(submission.code, initialBody, partId, false)}
        };
        console.log(data);
        newBlockPyEditor.loadAssignmentData_(data);
    }
    window.$ALL_BLOCKPY_EDITORS.push(newBlockPyEditor);

    ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
        newBlockPyEditor.destroy();
    });
}

ko.bindingHandlers.blockPyEditor = {
    'init': function (element, valueAccessor) {
        let options = ko.unwrap(valueAccessor());
        if (!options.launched && options.partId) {
            const editButton = $("<button class='btn btn-sm blockpy-run' style='margin-bottom: 10px'><span class='fas fa-play'></span> Run</button>");
            editButton.on('click', () => {
                editButton.hide();
                const newBlockPyEditorTag = $(`<div></div>`);
                $(element).append(newBlockPyEditorTag);
                const initialBody = $(element).prev().prev().text();
                //console.log(">>>", initialBody);
                launchBlockPy(newBlockPyEditorTag[0], options.partId, options.assignment().toJson(), options.submission().toJson(), initialBody || "");
                $(element).prev().prev().prev().hide();
            });
            $(element).before(editButton);
        }
        return { 'controlsDescendantBindings': true };
    },
}

ko.bindingHandlers.kettleLauncher = {
    'init': function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        let options = ko.unwrap(valueAccessor());
        if (!options.launched && options.partId) {
            const editButton = $("<button class='btn btn-sm btn-success kettle-launch' style='margin-bottom: 10px'><span class='fas fa-pencil'></span> Edit</button>");
            editButton.on('click', () => {
                editButton.hide();

                const initialBody = $(element).prev().prev().text();
                const newKettleTag = $(`
                    <kettle params=' server: $root.server,
                                      currentAssignmentId: currentAssignmentId,
                                      courseId: courseId, 
                                      assignmentGroupId: assignmentGroupId,
                                      isInstructor: isInstructor,
                                      markCorrect: markCorrect,
                                      user: user,
                                      smallLayout: true,
                                      language: ${JSON.stringify(options.language)},
                                      partId: ${JSON.stringify(options.partId)},
                                      initialCode: ${JSON.stringify(initialBody || "")}'></kettle>`);
                $(element).append(newKettleTag);
                ko.applyBindingsToDescendants(bindingContext, element);
                $(element).prev().prev().prev().hide();
            });
            $(element).before(editButton);
        }
        return { 'controlsDescendantBindings': false };
    }
}


/**
 * https://github.com/knockout/knockout/issues/416#issuecomment-4877853
 * Adds a new function to the ObservableArray class to efficiently push multiple values
 * @param valuesToPush
 */
export function pushObservableArray<T>(array: KnockoutObservableArray<T>, values: T[]): KnockoutObservableArray<T> {
    let underlyingArray = array();
    array.valueWillMutate();
    ko.utils.arrayPushAll(underlyingArray, values);
    array.valueHasMutated();
    return array;
}

// https://stackoverflow.com/a/60766129
export class TwoWayReadonlyMap {
    map: Map<string, string>;
    lefts: string[];
    rights: string[];

    constructor(map: Record<string, string>) {
        this.map = new Map<string, string>();
        this.lefts = [];
        this.rights = [];
        for (let member in map) {
            this.lefts.push(member);
            this.rights.push(map[member]);
            this.map.set(member, map[member]);
            this.map.set(map[member], member);
        }
    }

    get(key: string) {
        return this.map.get(key);
    }
}

export function capitalize(str: string): string {
    if (typeof str !== 'string') {
        return '';
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function last<T>(array: T[]): T {
    return array[array.length - 1];
}

/*
ko.bindingHandlers.select2 = {
    after: ["options", "value"],
    init: function (el, valueAccessor, allBindingsAccessor, viewModel) {
        $(el).select2(ko.unwrap(valueAccessor()));
        ko.utils.domNodeDisposal.addDisposeCallback(el, function () {
            $(el).select2('destroy');
        });
    },
    update: function (el, valueAccessor, allBindingsAccessor, viewModel) {
        var allBindings = allBindingsAccessor();
        var select2 = $(el).data("select2");
        if ("value" in allBindings) {
            var newValue = "" + ko.unwrap(allBindings.value);
            if ((allBindings.select2.multiple || el.multiple) && newValue.constructor !== Array) {
                // @ts-ignore
                select2.val([newValue.split(",")]);
            }
            else {
                // @ts-ignore
                select2.val([newValue]);
            }
        }
    }
};*/


ko.bindingHandlers.multiselect = {
    init: function (element, valueAccessor, allBindingAccessors) {
        let options = valueAccessor();

        // Pay attention to model updates
        ko.bindingHandlers['options'].update(element, () => options.options, allBindingAccessors);
        // TypeScript thinks that this bindingHandler has a smaller number of args for some reason
        // @ts-ignore
        ko.bindingHandlers['selectedOptions'].init(element, () => options.selectedOptions, allBindingAccessors);
        // @ts-ignore
        ko.bindingHandlers['selectedOptions'].update(element, () => options.selectedOptions, allBindingAccessors);

        // @ts-ignore
        $(element).multiSelect(options.config);


        //make view model know about select/deselect changes
        // @ts-ignore
        $(element).multiSelect({
            afterSelect: function (values: any) {
                for (let i = 0; i < values.length; i += 1) {
                    options.selectedOptions.push(values[i]);
                }
            }, afterDeselect: function (values: any) {
                for (let i = 0; i < values.length; i += 1) {
                    options.selectedOptions.remove(values[i]);
                }
            }
        });
    },
    update: function (element, valueAccessor, allBindingAccessors) {
        let options = valueAccessor();
        console.log(options.options(), options.selectedOptions());
        //update html if items set through code
        // @ts-ignore
        ko.bindingHandlers.selectedOptions.update(element, () => options.selectedOptions, allBindingAccessors);
        options.options().forEach((option: any) => {
            // @ts-ignore
            $(element).multiSelect("addOption", {value: option.id, text: option[options.optionsText]()})
        });

        // @ts-ignore
        $(element).multiSelect("refresh");
    }
};

/** Natural-order string comparison ("2" before "10"), the JS equivalent of natsorted. */
export function naturalCompare(left: string, right: string): number {
    return (left || "").localeCompare(right || "", undefined, {numeric: true, sensitivity: "base"});
}

/** assumes array elements are primitive types
 * check whether 2 arrays are equal sets.
 * @param  {} a1 is an array
 * @param  {} a2 is an array
 */
export function areArraysEqualSets(a1: number[], a2: number[]) {
    const superSet: Record<number, number> = {};
    for (const i of a1) {
        superSet[i] = 1;
    }

    for (const i of a2) {
        if (!superSet[i]) {
            return false;
        }
        superSet[i] = 2;
    }

    for (let i in superSet) {
        if (superSet[i] === 1) {
            return false;
        }
    }

    return true;
}

/** Simple binding for handling optgroups **/
ko.bindingHandlers.option = {
    update: function(element, valueAccessor) {
       let value = ko.utils.unwrapObservable(valueAccessor());
       ko.selectExtensions.writeValue(element, value);
    }
};

FilePond.registerPlugin(FilePondPluginImagePreview);

ko.bindingHandlers.filepond = {
    init: function (element, valueAccessor, allBindingAccessors) {
        let options = valueAccessor();
        //console.log("Initial options:", options);
        options.server.fileStore.listFiles(options.onlyPlacements || [], options.submission).then((fileRecord: BlockPyFileRecord) => {
            const allFiles: FilePond.FilePondInitialFile[] = [];
            Object.entries(fileRecord).forEach(([group, files]) => {
                files.forEach(([filename, url]: [string, string])=>allFiles.push({
                    source: url,
                    options: {
                        type: 'local',
                        /*file: {name: filename}*/
                    }
                }));
            });
            element.filepond = FilePond.create(element, {
                files: allFiles,
                allowMultiple: true,
                server: {
                    url: window["$URL_ROOT"],
                    load: (source, load) => {
                        //console.log(source);
                        const params = new URL(window["$URL_ROOT"]+source).searchParams;
                        ajax_get_file(source).then((data) => {
                            //console.log(data, params.get("filename"));
                            load(new File([data], params.get("filename")));
                        });
                    },
                    process: {
                        url: "blockpy/upload_file?placement=assignment&directory="+options.assignment().id,
                    }
                }
            });
        });
        ko.utils.domNodeDisposal.addDisposeCallback(element, function () {
            if (element.filepond) {
                element.filepond.destroy();
            }
        });
    },
    update: function (element, valueAccessor) {
        let newOptions = ko.unwrap(valueAccessor());
        //console.log("New OPtions:", newOptions);
    }
};