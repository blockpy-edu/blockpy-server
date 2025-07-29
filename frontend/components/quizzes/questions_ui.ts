export const QUESTIONS_SUBMISSION_UI = `
<div data-bind="foreach: quiz()?.questions">
        <div class="card m-4" data-bind="visible: visible() || !$component.asStudent(),">
            <div class="quizzer-question card-body">
                <quizzer-question-status params="indexId: 1+$index(), status: student, question: $data, isAnchor: true, 
                                                 quiz: $component.quiz(), asStudent: $component.asStudent()" class="float-right"></quizzer-question-status>
                <h5 class="card-title">Question <span data-bind="text: 1+$index()"></span></h5>
                <div data-bind="if: !$component.asStudent()" style="float: right">
                    <button class="btn btn-sm mr-2"
                        data-bind="click: ()=>$component.changeEditing($data, true),
                                   visible: $data.editing()">Save</button>
                   <button class="btn btn-sm mr-2"
                        data-bind="click: ()=>$component.changeEditing($data, false),
                                   text: $data.editing() ? 'Cancel' : 'Edit'"></button>
                </div>
                <h6 class="card-subtitle mb-2 text-muted">
                    <!-- ko if: feedback() && (!$component.asStudent() || $component.quiz().feedbackType() === 'IMMEDIATE') -->
                    <span data-bind="text: Math.round(((feedback().score * points) + Number.EPSILON) * 100) / 100 + ' /'"></span>
                    <!-- /ko -->
                    <span data-bind="text: points"></span> points
                    <span data-bind="text: ' ('+id+')', visible: !$component.asStudent()"></span>
                </h6>
                <div data-bind="if: pool() && !$component.asStudent()">
                    Pool: <span data-bind="text: pool().name"></span>
                </div>
                <div data-bind="visible: !$component.asStudent() || $parent.quiz().attemptCount() > 0">
                    <!-- ko if: $data.editing() -->
                    <textarea data-bind="markdowneditor: {value: $data.rawBody}" style="width: 100%; height: 200px"></textarea>
                    <!-- /ko -->
                    <div data-bind="visible: !$data.editing(), 
                                    markdowned: {value: $parent.quiz().makeBody($data, $index())}"></div>
                    <!-- Actual Question Code -->
                    <div data-bind="switch: type">
                        <!-- True/False Question -->
                        <div data-bind="case: 'true_false_question'">
                            <div class="form-check">
                                <label class="form-check-label" data-bind="attr: {for: 'question-tf-'+$index()+'-t'}">
                                  <input data-bind="checked: student,
                                                disable: $component.isReadOnly(),
                                                attr: {name: 'question-tf-'+$index()+'-t',
                                                       id: 'question-tf-'+$index()+'-t'}"
                                    class="form-check-input" type="radio" value="true">
                                    True
                              </label>
                            </div>
                            <div class="form-check">
                              <label class="form-check-label" data-bind="attr: {for: 'question-tf-'+$index()+'-f'}">
                                <input data-bind="checked: student,
                                            disable: $component.isReadOnly(),
                                            attr: {name: 'question-tf-'+$index()+'-f',
                                                   id: 'question-tf-'+$index()+'-f'}"
                                class="form-check-input" type="radio" value="false">
                                False
                              </label>
                            </div>
                        </div>
                        <!-- Multiple Choice -->
                        <div data-bind="case: 'multiple_choice_question'">
                            <!-- ko foreach: answers -->
                            <div class="form-check">
                              <label data-bind="attr: {for: 'question-mcq-'+$parentContext.$index()+'-'+$index()}" class="form-check-label">
                                  <input data-bind="checked: $parent.student,
                                                    value: $data,
                                                    disable: $component.isReadOnly(),
                                                    attr: {name: 'question-mcq-'+$parentContext.$index()+'-'+$index(),
                                                           id: 'question-mcq-'+$parentContext.$index()+'-'+$index()}"
                                    class="form-check-input" type="radio">
<!--                                    <span data-bind="html: $data"></span>-->
                                        <span data-bind="markdowned: {value: $data}"></span>
                              </label>
                            </div>
                            <!-- /ko -->
                        </div>
                        <!-- Multiple Answers Question -->
                        <div data-bind="case: 'multiple_answers_question'">
                            <!-- ko foreach: answers -->
                            <div class="form-check">
                              <label data-bind="attr: {for: 'question-maq-'+$parentContext.$index()+'-'+$index()}" class="form-check-label">
                              <input data-bind="checked: $parent.student,
                                                checkedValue: $data,
                                                disable: $component.isReadOnly(),
                                                attr: {id: 'question-maq-'+$parentContext.$index()+'-'+$index(),
                                                       name: 'question-maq-'+$parentContext.$index()+'-'+$index()}"
                                class="form-check-input" type="checkbox">
                                <span data-bind="html: $data"></span>
                              </label>
                            </div>
                            <!-- /ko -->
                        </div>
                        <!-- Text Only Question -->
                        <div data-bind="case: 'text_only_question'"></div>
                        <!-- Matching Question -->
                        <div data-bind="case: 'matching_question'" class="container">
                            <!-- ko foreach: statements -->
                            <div class="row justify-content-between mb-3">
<!--                                <div class="col" data-bind="html: $data"></div>-->
                                <div class="col" data-bind="markdowned: {value: $data}"></div>
                                <div class="col">
                                    <select class="custom-select"
                                        data-bind="options: $parent.retainOrder ? $parent.answers : $parent.answers.sort(() => Math.random() - 0.5),
                                                   disable: $component.isReadOnly(),
                                                   optionsCaption: '',
                                                   value: $parent.student[$index()],
                                                   attr: {id: 'question-mat-'+$parentContext.$index()+'-'+$index()}"></select>
                                </div>
                            </div>
                            <!-- /ko -->
                        </div>
                        <!-- Multiple Dropdown Question -->
                        <div data-bind="case: 'multiple_dropdowns_question'">
                        </div>
                        <!-- Short Answer -->
                        <div data-bind="case: 'short_answer_question'">
                            <div class="form-group">
                                <input type="text" class="form-control"
                                    data-bind="textInput: student, 
                                               disable: $component.isReadOnly(),
                                               attr: {id: 'question-sa-'+$index()}">
                            </div>
                        </div>
                        <div data-bind="case: 'essay_question'">
                        <textarea data-bind="textInput: student, 
                                               disable: $component.isReadOnly(),
                                               attr: {id: 'question-es-'+$index()}" style="width: 100%; height: 300px"></textarea><br>
                        </div>
                        <!-- Numerical Input -->
                        <div data-bind="case: 'numerical_question'">
                            <div class="form-group">
                                <input type="number" class="form-control"
                                    data-bind="textInput: student, 
                                               disable: $component.isReadOnly(),
                                               attr: {id: 'question-num-'+$index()}">
                            </div>
                        </div>
                        <!-- Multiple Fill in the Blank Question -->
                        <div data-bind="case: 'fill_in_multiple_blanks_question'">
                        </div>
                        <!-- Else -->
                        <div data-bind="case: $default">
                            I have no idea what this is!
                        </div>
                    </div>
                </div>
                <!-- ko if: feedback() && (!$component.asStudent() || $component.quiz().feedbackType() === 'IMMEDIATE') -->
                <div class="border rounded m-2 p-2" data-bind="class: feedback().status == 'error' ? 'bg-dark' :
                                                                      feedback().correct ? 'bg-success' : 'bg-danger'">
                    <span data-bind="html: feedback().message" class="text-white"></span>
                </div>
                <!-- /ko -->
            </div>
        </div>
    </div>
`;


export const QUESTIONS_EDITOR_UI = `
`;