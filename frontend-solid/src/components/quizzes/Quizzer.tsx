/**
 * Main Quizzer component - SolidJS implementation
 */

import { Component, createSignal, createMemo, For, Show } from 'solid-js';
import { Quiz } from './Quiz';
import { QuizData, QuizMode, QuizFeedbackType } from './types';
import { QuestionComponent } from './QuestionComponent';
import './Quizzer.css';

export interface QuizzerProps {
  quizData: QuizData;
  isInstructor?: boolean;
}

export const Quizzer: Component<QuizzerProps> = (props) => {
  const [quiz] = createSignal(new Quiz(props.quizData));
  const [asStudent, setAsStudent] = createSignal(!props.isInstructor);
  const [isDirty, setIsDirty] = createSignal(false);

  const q = quiz();
  
  const visibleQuestions = createMemo(() => {
    return q.getQuestions().filter(question => {
      // In instructor mode, show all questions
      // In student mode, only show if quiz is being attempted or completed
      return asStudent() ? q.attemptStatus !== QuizMode.READY : true;
    });
  });

  const handleAnswerChange = (questionId: string, answer: any) => {
    q.submitAnswer(questionId, answer);
    setIsDirty(true);
    
    // Clear dirty flag after a short delay (simulating auto-save)
    setTimeout(() => setIsDirty(false), 1000);
  };

  const handleStartQuiz = () => {
    q.startQuiz();
  };

  const handleSubmitQuiz = async () => {
    q.submitQuiz();
    // Here you would typically make an API call to save the submission
    console.log('Submitting quiz:', q.toSubmissionJSON());
  };

  const toggleViewMode = () => {
    setAsStudent(!asStudent());
  };

  return (
    <div class="quizzer-container">
      {/* Instructor Controls */}
      <Show when={props.isInstructor}>
        <div class="instructor-controls mb-3 p-2 bg-light border rounded">
          <button
            class="btn btn-sm btn-outline-secondary"
            onClick={toggleViewMode}
          >
            View as: {asStudent() ? 'Student' : 'Instructor'}
          </button>
        </div>
      </Show>

      {/* Quiz Status Bar */}
      <div class="quiz-status-bar mb-4 p-3 border rounded">
        <Show when={isDirty()}>
          <small class="alert alert-info p-1 border rounded float-right">
            Saving changes
          </small>
        </Show>

        <div class="quiz-status">
          <Show when={q.attemptStatus === QuizMode.READY}>
            <div>
              <p>To begin the quiz, click "Start Quiz".</p>
              <p>You have {q.attemptsLeft}</p>
              <Show when={q.canAttempt()}>
                <div class="text-center">
                  <button
                    class="btn btn-success"
                    onClick={handleStartQuiz}
                  >
                    Start Quiz
                  </button>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={q.attemptStatus === QuizMode.ATTEMPTING}>
            <div>
              <p><strong>Quiz In Progress!</strong></p>
              <div class="text-center">
                <button
                  class="btn btn-success"
                  onClick={handleSubmitQuiz}
                  disabled={isDirty()}
                >
                  Submit Quiz
                </button>
              </div>
            </div>
          </Show>

          <Show when={q.attemptStatus === QuizMode.COMPLETED}>
            <div>
              <p>You have completed the quiz.</p>
              
              <Show when={q.feedbackType === QuizFeedbackType.IMMEDIATE}>
                <p>You can see the feedback for each question below.</p>
              </Show>
              <Show when={q.feedbackType === QuizFeedbackType.SUMMARY}>
                <p>
                  However, you will <strong>not</strong> see any feedback until
                  the instructor releases grades; the feedback you receive will
                  be limited.
                </p>
              </Show>
              <Show when={q.feedbackType === QuizFeedbackType.NONE}>
                <p>
                  However, you will <strong>not</strong> see any feedback.
                </p>
              </Show>

              <p>You have {q.attemptsLeft}</p>
              <Show when={q.canAttempt()}>
                <div class="text-center">
                  <p>To try again, click "Start Quiz".</p>
                  <button
                    class="btn btn-success"
                    onClick={handleStartQuiz}
                  >
                    Try Quiz Again
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      {/* Questions */}
      <div class="quiz-questions">
        <For each={visibleQuestions()}>
          {(question) => {
            const answer = () => q.studentAnswers()[question.id];
            const feedbackData = () => q.feedback()[question.id];
            const showFeedback = () =>
              q.attemptStatus === QuizMode.COMPLETED &&
              q.feedbackType === QuizFeedbackType.IMMEDIATE;

            return (
              <QuestionComponent
                question={question}
                answer={answer()}
                onAnswerChange={(newAnswer) => handleAnswerChange(question.id, newAnswer)}
                showFeedback={showFeedback()}
                feedbackMessage={feedbackData()?.message}
                readonly={q.attemptStatus !== QuizMode.ATTEMPTING}
              />
            );
          }}
        </For>
      </div>

      {/* Bottom Submit Button (for convenience) */}
      <Show when={q.attemptStatus === QuizMode.ATTEMPTING}>
        <div class="text-center mt-4">
          <button
            class="btn btn-success btn-lg"
            onClick={handleSubmitQuiz}
            disabled={isDirty()}
          >
            Submit Quiz
          </button>
        </div>
      </Show>
    </div>
  );
};
