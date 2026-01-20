/**
 * Question components for different quiz question types
 */

import { Component, Show, For, createMemo } from 'solid-js';
import {
  Question,
  MultipleChoiceQuestion,
  TrueFalseQuestion,
  ShortAnswerQuestion,
  MultipleAnswersQuestion,
  MultipleDropdownsQuestion,
  FillInMultipleBlanksQuestion,
  QuizQuestionType
} from './types';

// Regular expression to match square brackets (not escaped)
const SQUARE_BRACKETS = /(?<!\\)(\[.*?\])(?!\()/g;

/**
 * Extract bracketed identifiers from question body text
 * e.g., "The [color] of the sky is [shade]" -> ["color", "shade"]
 */
function getBracketed(body: string): string[] {
  const matches = body.match(SQUARE_BRACKETS);
  if (!matches) return [];
  
  return matches
    .filter((part: string) => !(part.startsWith('[[') && part.endsWith(']]')))
    .map((part: string) => part.slice(1, -1));
}

/**
 * Parse body text and replace [identifier] with components
 * Returns array of text segments and identifiers
 */
function parseBodyWithBlanks(body: string): Array<{ type: 'text' | 'blank', content: string }> {
  const parts: Array<{ type: 'text' | 'blank', content: string }> = [];
  let lastIndex = 0;
  
  const regex = /(?<!\\)\[([^\]]+)\](?!\()/g;
  let match;
  
  while ((match = regex.exec(body)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: body.substring(lastIndex, match.index)
      });
    }
    
    // Add the blank/dropdown identifier
    parts.push({
      type: 'blank',
      content: match[1]
    });
    
    lastIndex = regex.lastIndex;
  }
  
  // Add remaining text
  if (lastIndex < body.length) {
    parts.push({
      type: 'text',
      content: body.substring(lastIndex)
    });
  }
  
  return parts;
}

interface QuestionProps {
  question: Question;
  answer: any;
  onAnswerChange: (answer: any) => void;
  showFeedback?: boolean;
  feedbackMessage?: string;
  readonly?: boolean;
}

export const QuestionComponent: Component<QuestionProps> = (props) => {
  // For multiple dropdowns and fill in blanks, we need special rendering
  const usesEmbeddedInputs = createMemo(() => 
    props.question.type === QuizQuestionType.multiple_dropdowns_question ||
    props.question.type === QuizQuestionType.fill_in_multiple_blanks_question
  );

  return (
    <div class="quiz-question mb-4 p-3 border rounded">
      {/* For questions with embedded inputs, render them inline */}
      <Show when={usesEmbeddedInputs()}>
        <Show when={props.question.type === QuizQuestionType.multiple_dropdowns_question}>
          <MultipleDropdownsInput
            question={props.question as MultipleDropdownsQuestion}
            answer={props.answer}
            onAnswerChange={props.onAnswerChange}
            readonly={props.readonly}
          />
        </Show>
        <Show when={props.question.type === QuizQuestionType.fill_in_multiple_blanks_question}>
          <FillInMultipleBlanksInput
            question={props.question as FillInMultipleBlanksQuestion}
            answer={props.answer}
            onAnswerChange={props.onAnswerChange}
            readonly={props.readonly}
          />
        </Show>
      </Show>

      {/* For regular questions, show body then input */}
      <Show when={!usesEmbeddedInputs()}>
        <div class="question-body mb-3" innerHTML={props.question.body} />
        
        <Show when={props.question.type === QuizQuestionType.multiple_choice_question}>
          <MultipleChoiceInput
            question={props.question as MultipleChoiceQuestion}
            answer={props.answer}
            onAnswerChange={props.onAnswerChange}
            readonly={props.readonly}
          />
        </Show>
        
        <Show when={props.question.type === QuizQuestionType.true_false_question}>
          <TrueFalseInput
            answer={props.answer}
            onAnswerChange={props.onAnswerChange}
            readonly={props.readonly}
          />
        </Show>
        
        <Show when={props.question.type === QuizQuestionType.short_answer_question}>
          <ShortAnswerInput
            answer={props.answer}
            onAnswerChange={props.onAnswerChange}
            readonly={props.readonly}
          />
        </Show>
        
        <Show when={props.question.type === QuizQuestionType.multiple_answers_question}>
          <MultipleAnswersInput
            question={props.question as MultipleAnswersQuestion}
            answer={props.answer}
            onAnswerChange={props.onAnswerChange}
            readonly={props.readonly}
          />
        </Show>
      </Show>
      
      <Show when={props.showFeedback && props.feedbackMessage}>
        <div class="alert alert-info mt-3">
          <strong>Feedback:</strong>
          <div innerHTML={props.feedbackMessage} />
        </div>
      </Show>
    </div>
  );
};

const MultipleChoiceInput: Component<{
  question: MultipleChoiceQuestion;
  answer: string;
  onAnswerChange: (answer: string) => void;
  readonly?: boolean;
}> = (props) => {
  return (
    <div class="multiple-choice-options">
      <For each={props.question.answers}>
        {(option, index) => (
          <div class="form-check">
            <input
              class="form-check-input"
              type="radio"
              name={`mc-${props.question.id}`}
              id={`${props.question.id}-${index()}`}
              value={option}
              checked={props.answer === option}
              onChange={(e) => props.onAnswerChange(e.currentTarget.value)}
              disabled={props.readonly}
            />
            <label class="form-check-label" for={`${props.question.id}-${index()}`}>
              {option}
            </label>
          </div>
        )}
      </For>
    </div>
  );
};

const TrueFalseInput: Component<{
  answer: boolean | string;
  onAnswerChange: (answer: boolean) => void;
  readonly?: boolean;
}> = (props) => {
  return (
    <div class="true-false-options">
      <div class="form-check">
        <input
          class="form-check-input"
          type="radio"
          name="tf"
          id="tf-true"
          checked={props.answer === true || props.answer === 'true'}
          onChange={() => props.onAnswerChange(true)}
          disabled={props.readonly}
        />
        <label class="form-check-label" for="tf-true">
          True
        </label>
      </div>
      <div class="form-check">
        <input
          class="form-check-input"
          type="radio"
          name="tf"
          id="tf-false"
          checked={props.answer === false || props.answer === 'false'}
          onChange={() => props.onAnswerChange(false)}
          disabled={props.readonly}
        />
        <label class="form-check-label" for="tf-false">
          False
        </label>
      </div>
    </div>
  );
};

const ShortAnswerInput: Component<{
  answer: string;
  onAnswerChange: (answer: string) => void;
  readonly?: boolean;
}> = (props) => {
  return (
    <div class="short-answer-input">
      <input
        type="text"
        class="form-control"
        value={props.answer || ''}
        onInput={(e) => props.onAnswerChange(e.currentTarget.value)}
        placeholder="Enter your answer"
        disabled={props.readonly}
      />
    </div>
  );
};

const MultipleAnswersInput: Component<{
  question: MultipleAnswersQuestion;
  answer: string[];
  onAnswerChange: (answer: string[]) => void;
  readonly?: boolean;
}> = (props) => {
  const handleCheckboxChange = (option: string, checked: boolean) => {
    const currentAnswers = props.answer || [];
    if (checked) {
      props.onAnswerChange([...currentAnswers, option]);
    } else {
      props.onAnswerChange(currentAnswers.filter(a => a !== option));
    }
  };

  return (
    <div class="multiple-answers-options">
      <For each={props.question.answers}>
        {(option, index) => (
          <div class="form-check">
            <input
              class="form-check-input"
              type="checkbox"
              id={`${props.question.id}-${index()}`}
              checked={props.answer && props.answer.includes(option)}
              onChange={(e) => handleCheckboxChange(option, e.currentTarget.checked)}
              disabled={props.readonly}
            />
            <label class="form-check-label" for={`${props.question.id}-${index()}`}>
              {option}
            </label>
          </div>
        )}
      </For>
    </div>
  );
};

const MultipleDropdownsInput: Component<{
  question: MultipleDropdownsQuestion;
  answer: Record<string, string>;
  onAnswerChange: (answer: Record<string, string>) => void;
  readonly?: boolean;
}> = (props) => {
  const parts = createMemo(() => parseBodyWithBlanks(props.question.body));

  const handleDropdownChange = (identifier: string, value: string) => {
    const newAnswer = { ...(props.answer || {}) };
    newAnswer[identifier] = value;
    props.onAnswerChange(newAnswer);
  };

  return (
    <div class="multiple-dropdowns-question">
      <div class="question-body-with-dropdowns mb-3">
        <For each={parts()}>
          {(part) => (
            <>
              <Show when={part.type === 'text'}>
                <span innerHTML={part.content} />
              </Show>
              <Show when={part.type === 'blank'}>
                <select
                  class="form-select d-inline-block mx-1"
                  style="width: auto; min-width: 120px;"
                  value={props.answer?.[part.content] || ''}
                  onChange={(e) => handleDropdownChange(part.content, e.currentTarget.value)}
                  disabled={props.readonly}
                >
                  <option value="">-- Select --</option>
                  <For each={props.question.answers[part.content] || []}>
                    {(option) => (
                      <option value={option}>{option}</option>
                    )}
                  </For>
                </select>
              </Show>
            </>
          )}
        </For>
      </div>
    </div>
  );
};

const FillInMultipleBlanksInput: Component<{
  question: FillInMultipleBlanksQuestion;
  answer: Record<string, string>;
  onAnswerChange: (answer: Record<string, string>) => void;
  readonly?: boolean;
}> = (props) => {
  const parts = createMemo(() => parseBodyWithBlanks(props.question.body));

  const handleInputChange = (identifier: string, value: string) => {
    const newAnswer = { ...(props.answer || {}) };
    newAnswer[identifier] = value;
    props.onAnswerChange(newAnswer);
  };

  return (
    <div class="fill-in-multiple-blanks-question">
      <div class="question-body-with-blanks mb-3">
        <For each={parts()}>
          {(part) => (
            <>
              <Show when={part.type === 'text'}>
                <span innerHTML={part.content} />
              </Show>
              <Show when={part.type === 'blank'}>
                <input
                  type="text"
                  class="form-control d-inline-block mx-1"
                  style="width: auto; min-width: 150px;"
                  placeholder={part.content}
                  value={props.answer?.[part.content] || ''}
                  onInput={(e) => handleInputChange(part.content, e.currentTarget.value)}
                  disabled={props.readonly}
                />
              </Show>
            </>
          )}
        </For>
      </div>
    </div>
  );
};
