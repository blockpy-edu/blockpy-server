/**
 * Question components for different quiz question types
 */

import { Component, Show, For } from 'solid-js';
import {
  Question,
  MultipleChoiceQuestion,
  TrueFalseQuestion,
  ShortAnswerQuestion,
  MultipleAnswersQuestion,
  QuizQuestionType
} from './types';

interface QuestionProps {
  question: Question;
  answer: any;
  onAnswerChange: (answer: any) => void;
  showFeedback?: boolean;
  feedbackMessage?: string;
  readonly?: boolean;
}

export const QuestionComponent: Component<QuestionProps> = (props) => {
  return (
    <div class="quiz-question mb-4 p-3 border rounded">
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
