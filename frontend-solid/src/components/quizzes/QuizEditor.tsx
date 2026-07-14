/**
 * Quiz Editor - Interactive quiz creation and editing with undo/redo
 */

import { Component, createSignal, For, Show, createMemo } from 'solid-js';
import { Question, QuizQuestionType, QuizData } from './types';

// Editor actions for undo/redo
interface EditorAction {
  type: 'add' | 'delete' | 'reorder' | 'edit' | 'changeType';
  questionId?: string;
  previousState?: any;
  newState?: any;
  fromIndex?: number;
  toIndex?: number;
}

interface QuizEditorProps {
  quizData: QuizData;
  onSave?: (data: QuizData) => void;
}

export const QuizEditor: Component<QuizEditorProps> = (props) => {
  const [questions, setQuestions] = createSignal<Record<string, Question>>(
    props.quizData.instructions.questions
  );
  const [questionOrder, setQuestionOrder] = createSignal<string[]>(
    Object.keys(props.quizData.instructions.questions)
  );
  const [undoStack, setUndoStack] = createSignal<EditorAction[]>([]);
  const [redoStack, setRedoStack] = createSignal<EditorAction[]>([]);
  const [selectedQuestion, setSelectedQuestion] = createSignal<string | null>(null);
  const [editingBody, setEditingBody] = createSignal<string | null>(null);

  const canUndo = createMemo(() => undoStack().length > 0);
  const canRedo = createMemo(() => redoStack().length > 0);

  // Add action to undo stack and clear redo stack
  const recordAction = (action: EditorAction) => {
    setUndoStack([...undoStack(), action]);
    setRedoStack([]); // Clear redo stack when new action is performed
  };

  // Generate unique question ID
  const generateQuestionId = (): string => {
    const existingIds = Object.keys(questions());
    let id = `q${existingIds.length + 1}`;
    let counter = existingIds.length + 1;
    while (existingIds.includes(id)) {
      counter++;
      id = `q${counter}`;
    }
    return id;
  };

  // Add new question
  const addQuestion = (type: QuizQuestionType = QuizQuestionType.multiple_choice_question) => {
    const newId = generateQuestionId();
    const newQuestion: Question = {
      id: newId,
      type,
      body: '<p>New question</p>',
      points: 1,
      ...(type === QuizQuestionType.multiple_choice_question && {
        answers: ['Option 1', 'Option 2', 'Option 3']
      }),
      ...(type === QuizQuestionType.true_false_question && {}),
      ...(type === QuizQuestionType.short_answer_question && {}),
      ...(type === QuizQuestionType.multiple_answers_question && {
        answers: ['Option 1', 'Option 2', 'Option 3']
      }),
      ...(type === QuizQuestionType.multiple_dropdowns_question && {
        answers: { blank1: ['Option 1', 'Option 2'] },
        retainOrder: false
      }),
      ...(type === QuizQuestionType.fill_in_multiple_blanks_question && {})
    } as Question;

    setQuestions({ ...questions(), [newId]: newQuestion });
    setQuestionOrder([...questionOrder(), newId]);
    
    recordAction({
      type: 'add',
      questionId: newId,
      newState: newQuestion
    });
  };

  // Delete question
  const deleteQuestion = (id: string) => {
    const questionsCopy = { ...questions() };
    const deletedQuestion = questionsCopy[id];
    delete questionsCopy[id];
    
    setQuestions(questionsCopy);
    setQuestionOrder(questionOrder().filter(qId => qId !== id));
    
    if (selectedQuestion() === id) {
      setSelectedQuestion(null);
    }
    
    recordAction({
      type: 'delete',
      questionId: id,
      previousState: deletedQuestion
    });
  };

  // Move question up or down
  const moveQuestion = (id: string, direction: 'up' | 'down') => {
    const order = [...questionOrder()];
    const index = order.indexOf(id);
    
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === order.length - 1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [order[index], order[newIndex]] = [order[newIndex], order[index]];
    
    setQuestionOrder(order);
    
    recordAction({
      type: 'reorder',
      questionId: id,
      fromIndex: index,
      toIndex: newIndex
    });
  };

  // Edit question body
  const updateQuestionBody = (id: string, newBody: string) => {
    const questionsCopy = { ...questions() };
    const oldBody = questionsCopy[id].body;
    questionsCopy[id] = { ...questionsCopy[id], body: newBody };
    
    setQuestions(questionsCopy);
    setEditingBody(null);
    
    recordAction({
      type: 'edit',
      questionId: id,
      previousState: { body: oldBody },
      newState: { body: newBody }
    });
  };

  // Change question type
  const changeQuestionType = (id: string, newType: QuizQuestionType) => {
    const questionsCopy = { ...questions() };
    const oldQuestion = questionsCopy[id];
    
    const baseQuestion = {
      id,
      type: newType,
      body: oldQuestion.body,
      points: oldQuestion.points
    };

    // Add type-specific properties
    let newQuestion: Question;
    switch (newType) {
      case QuizQuestionType.multiple_choice_question:
        newQuestion = { ...baseQuestion, answers: ['Option 1', 'Option 2', 'Option 3'] } as any;
        break;
      case QuizQuestionType.multiple_answers_question:
        newQuestion = { ...baseQuestion, answers: ['Option 1', 'Option 2', 'Option 3'] } as any;
        break;
      case QuizQuestionType.multiple_dropdowns_question:
        newQuestion = { ...baseQuestion, answers: { blank1: ['Option 1', 'Option 2'] }, retainOrder: false } as any;
        break;
      case QuizQuestionType.true_false_question:
      case QuizQuestionType.short_answer_question:
      case QuizQuestionType.fill_in_multiple_blanks_question:
      default:
        newQuestion = baseQuestion as any;
    }
    
    questionsCopy[id] = newQuestion;
    setQuestions(questionsCopy);
    
    recordAction({
      type: 'changeType',
      questionId: id,
      previousState: oldQuestion,
      newState: newQuestion
    });
  };

  // Undo last action
  const undo = () => {
    const actions = undoStack();
    if (actions.length === 0) return;
    
    const action = actions[actions.length - 1];
    setUndoStack(actions.slice(0, -1));
    setRedoStack([...redoStack(), action]);
    
    switch (action.type) {
      case 'add':
        // Remove the added question
        const questionsAfterUndoAdd = { ...questions() };
        delete questionsAfterUndoAdd[action.questionId!];
        setQuestions(questionsAfterUndoAdd);
        setQuestionOrder(questionOrder().filter(id => id !== action.questionId));
        break;
        
      case 'delete':
        // Restore the deleted question
        setQuestions({ ...questions(), [action.questionId!]: action.previousState });
        setQuestionOrder([...questionOrder(), action.questionId!]);
        break;
        
      case 'reorder':
        // Reverse the reorder
        const orderAfterUndo = [...questionOrder()];
        [orderAfterUndo[action.fromIndex!], orderAfterUndo[action.toIndex!]] = 
          [orderAfterUndo[action.toIndex!], orderAfterUndo[action.fromIndex!]];
        setQuestionOrder(orderAfterUndo);
        break;
        
      case 'edit':
        // Restore previous body
        const questionsAfterUndoEdit = { ...questions() };
        questionsAfterUndoEdit[action.questionId!] = {
          ...questionsAfterUndoEdit[action.questionId!],
          ...action.previousState
        };
        setQuestions(questionsAfterUndoEdit);
        break;
        
      case 'changeType':
        // Restore previous question type
        const questionsAfterUndoType = { ...questions() };
        questionsAfterUndoType[action.questionId!] = action.previousState;
        setQuestions(questionsAfterUndoType);
        break;
    }
  };

  // Redo last undone action
  const redo = () => {
    const actions = redoStack();
    if (actions.length === 0) return;
    
    const action = actions[actions.length - 1];
    setRedoStack(actions.slice(0, -1));
    setUndoStack([...undoStack(), action]);
    
    switch (action.type) {
      case 'add':
        // Re-add the question
        setQuestions({ ...questions(), [action.questionId!]: action.newState });
        setQuestionOrder([...questionOrder(), action.questionId!]);
        break;
        
      case 'delete':
        // Re-delete the question
        const questionsAfterRedoDelete = { ...questions() };
        delete questionsAfterRedoDelete[action.questionId!];
        setQuestions(questionsAfterRedoDelete);
        setQuestionOrder(questionOrder().filter(id => id !== action.questionId));
        break;
        
      case 'reorder':
        // Re-apply the reorder
        const orderAfterRedo = [...questionOrder()];
        [orderAfterRedo[action.fromIndex!], orderAfterRedo[action.toIndex!]] = 
          [orderAfterRedo[action.toIndex!], orderAfterRedo[action.fromIndex!]];
        setQuestionOrder(orderAfterRedo);
        break;
        
      case 'edit':
        // Re-apply the edit
        const questionsAfterRedoEdit = { ...questions() };
        questionsAfterRedoEdit[action.questionId!] = {
          ...questionsAfterRedoEdit[action.questionId!],
          ...action.newState
        };
        setQuestions(questionsAfterRedoEdit);
        break;
        
      case 'changeType':
        // Re-apply the type change
        const questionsAfterRedoType = { ...questions() };
        questionsAfterRedoType[action.questionId!] = action.newState;
        setQuestions(questionsAfterRedoType);
        break;
    }
  };

  // Save quiz
  const saveQuiz = () => {
    const updatedQuizData: QuizData = {
      ...props.quizData,
      instructions: {
        ...props.quizData.instructions,
        questions: questions()
      }
    };
    
    props.onSave?.(updatedQuizData);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
    }
  };

  // Question type display names
  const questionTypeNames: Record<QuizQuestionType, string> = {
    [QuizQuestionType.multiple_choice_question]: 'Multiple Choice',
    [QuizQuestionType.true_false_question]: 'True/False',
    [QuizQuestionType.short_answer_question]: 'Short Answer',
    [QuizQuestionType.multiple_answers_question]: 'Multiple Answers',
    [QuizQuestionType.multiple_dropdowns_question]: 'Multiple Dropdowns',
    [QuizQuestionType.fill_in_multiple_blanks_question]: 'Fill in Blanks',
    [QuizQuestionType.matching_question]: 'Matching',
    [QuizQuestionType.essay_question]: 'Essay',
    [QuizQuestionType.numerical_question]: 'Numerical',
    [QuizQuestionType.text_only_question]: 'Text Only',
    [QuizQuestionType.calculated_question]: 'Calculated',
    [QuizQuestionType.file_upload_question]: 'File Upload'
  };

  return (
    <div class="quiz-editor" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div class="editor-toolbar bg-light p-3 mb-3 border rounded">
        <div class="d-flex justify-content-between align-items-center">
          <div class="btn-group">
            <button
              class="btn btn-primary"
              onClick={() => addQuestion(QuizQuestionType.multiple_choice_question)}
            >
              <i class="bi bi-plus-circle"></i> Add Question
            </button>
            <button
              class="btn btn-outline-primary dropdown-toggle"
              data-bs-toggle="dropdown"
            >
              Type
            </button>
            <ul class="dropdown-menu">
              <li>
                <button
                  class="dropdown-item"
                  onClick={() => addQuestion(QuizQuestionType.multiple_choice_question)}
                >
                  Multiple Choice
                </button>
              </li>
              <li>
                <button
                  class="dropdown-item"
                  onClick={() => addQuestion(QuizQuestionType.true_false_question)}
                >
                  True/False
                </button>
              </li>
              <li>
                <button
                  class="dropdown-item"
                  onClick={() => addQuestion(QuizQuestionType.short_answer_question)}
                >
                  Short Answer
                </button>
              </li>
              <li>
                <button
                  class="dropdown-item"
                  onClick={() => addQuestion(QuizQuestionType.multiple_answers_question)}
                >
                  Multiple Answers
                </button>
              </li>
              <li>
                <button
                  class="dropdown-item"
                  onClick={() => addQuestion(QuizQuestionType.multiple_dropdowns_question)}
                >
                  Multiple Dropdowns
                </button>
              </li>
              <li>
                <button
                  class="dropdown-item"
                  onClick={() => addQuestion(QuizQuestionType.fill_in_multiple_blanks_question)}
                >
                  Fill in Blanks
                </button>
              </li>
            </ul>
          </div>
          
          <div class="btn-group">
            <button
              class="btn btn-outline-secondary"
              onClick={undo}
              disabled={!canUndo()}
              title="Undo (Ctrl+Z)"
            >
              <i class="bi bi-arrow-counterclockwise"></i> Undo
            </button>
            <button
              class="btn btn-outline-secondary"
              onClick={redo}
              disabled={!canRedo()}
              title="Redo (Ctrl+Shift+Z)"
            >
              <i class="bi bi-arrow-clockwise"></i> Redo
            </button>
          </div>
          
          <button class="btn btn-success" onClick={saveQuiz}>
            <i class="bi bi-save"></i> Save Quiz
          </button>
        </div>
        
        <div class="mt-2 text-muted small">
          <strong>{questionOrder().length}</strong> question{questionOrder().length !== 1 ? 's' : ''}
          {' • '}
          <strong>{undoStack().length}</strong> action{undoStack().length !== 1 ? 's' : ''} in history
        </div>
      </div>

      {/* Question list */}
      <div class="questions-list">
        <Show when={questionOrder().length === 0}>
          <div class="alert alert-info">
            No questions yet. Click "Add Question" to create your first question.
          </div>
        </Show>
        
        <For each={questionOrder()}>
          {(questionId, index) => {
            const question = () => questions()[questionId];
            const isSelected = () => selectedQuestion() === questionId;
            const isEditing = () => editingBody() === questionId;
            
            return (
              <div
                class={`question-card card mb-3 ${isSelected() ? 'border-primary' : ''}`}
                onClick={() => setSelectedQuestion(questionId)}
              >
                <div class="card-header d-flex justify-content-between align-items-center">
                  <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-secondary">#{index() + 1}</span>
                    <span class="badge bg-info">{questionTypeNames[question().type]}</span>
                    <span class="text-muted small">{question().points || 0} pt{question().points !== 1 ? 's' : ''}</span>
                  </div>
                  
                  <div class="btn-group btn-group-sm">
                    <button
                      class="btn btn-outline-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(questionId, 'up');
                      }}
                      disabled={index() === 0}
                      title="Move up"
                    >
                      <i class="bi bi-arrow-up"></i>
                    </button>
                    <button
                      class="btn btn-outline-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveQuestion(questionId, 'down');
                      }}
                      disabled={index() === questionOrder().length - 1}
                      title="Move down"
                    >
                      <i class="bi bi-arrow-down"></i>
                    </button>
                    <button
                      class="btn btn-outline-danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this question?')) {
                          deleteQuestion(questionId);
                        }
                      }}
                      title="Delete"
                    >
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
                
                <div class="card-body">
                  <Show when={!isEditing()}>
                    <div
                      class="question-body mb-2"
                      innerHTML={question().body}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingBody(questionId);
                      }}
                      style="cursor: pointer; min-height: 2em;"
                    />
                  </Show>
                  
                  <Show when={isEditing()}>
                    <textarea
                      class="form-control mb-2"
                      value={question().body.replace(/<[^>]*>/g, '')}
                      onInput={(e) => {
                        const newBody = `<p>${e.currentTarget.value}</p>`;
                        const questionsCopy = { ...questions() };
                        questionsCopy[questionId] = { ...questionsCopy[questionId], body: newBody };
                        setQuestions(questionsCopy);
                      }}
                      onBlur={() => setEditingBody(null)}
                      onClick={(e) => e.stopPropagation()}
                      rows={3}
                      autofocus
                    />
                  </Show>
                  
                  <Show when={isSelected()}>
                    <div class="question-options mt-3 p-2 bg-light rounded">
                      <div class="mb-2">
                        <label class="form-label small">Question Type:</label>
                        <select
                          class="form-select form-select-sm"
                          value={question().type}
                          onChange={(e) => changeQuestionType(questionId, e.currentTarget.value as QuizQuestionType)}
                        >
                          <For each={Object.values(QuizQuestionType).filter(t => 
                            [
                              QuizQuestionType.multiple_choice_question,
                              QuizQuestionType.true_false_question,
                              QuizQuestionType.short_answer_question,
                              QuizQuestionType.multiple_answers_question,
                              QuizQuestionType.multiple_dropdowns_question,
                              QuizQuestionType.fill_in_multiple_blanks_question
                            ].includes(t)
                          )}>
                            {(type) => (
                              <option value={type}>{questionTypeNames[type]}</option>
                            )}
                          </For>
                        </select>
                      </div>
                      
                      <div class="mb-2">
                        <label class="form-label small">Points:</label>
                        <input
                          type="number"
                          class="form-control form-control-sm"
                          value={question().points || 0}
                          min={0}
                          onChange={(e) => {
                            const questionsCopy = { ...questions() };
                            questionsCopy[questionId] = {
                              ...questionsCopy[questionId],
                              points: parseInt(e.currentTarget.value) || 0
                            };
                            setQuestions(questionsCopy);
                          }}
                        />
                      </div>
                    </div>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
