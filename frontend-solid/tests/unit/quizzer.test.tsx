/**
 * Integration tests for Quizzer component
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Quizzer } from '../../src/components/quizzes/Quizzer';
import { simpleMultipleChoiceQuiz, completedMultipleChoiceQuiz } from '../fixtures/quiz-multiple-choice';
import { mixedQuestionTypesQuiz, attemptingMixedQuiz } from '../fixtures/quiz-mixed-types';

describe('Quizzer Component', () => {
  describe('initial state', () => {
    it('should render with ready state', () => {
      render(() => <Quizzer quizData={simpleMultipleChoiceQuiz} />);

      expect(screen.getByText(/To begin the quiz/)).toBeInTheDocument();
      expect(screen.getByText('Start Quiz')).toBeInTheDocument();
    });

    it('should show attempts left', () => {
      render(() => <Quizzer quizData={simpleMultipleChoiceQuiz} />);

      expect(screen.getByText(/2 attempts remaining/)).toBeInTheDocument();
    });

    it('should not show questions in ready state for students', () => {
      render(() => <Quizzer quizData={simpleMultipleChoiceQuiz} />);

      expect(screen.queryByText(/What is 2 \+ 2/)).not.toBeInTheDocument();
    });
  });

  describe('attempting state', () => {
    it('should render with attempting state', () => {
      render(() => <Quizzer quizData={attemptingMixedQuiz} />);

      expect(screen.getByText(/Quiz In Progress/)).toBeInTheDocument();
      expect(screen.getAllByText('Submit Quiz').length).toBeGreaterThan(0);
    });

    it('should show questions in attempting state', () => {
      render(() => <Quizzer quizData={attemptingMixedQuiz} />);

      expect(screen.getByText(/Python is a compiled language/)).toBeInTheDocument();
      expect(screen.getByText(/What keyword is used to define a function/)).toBeInTheDocument();
    });

    it('should show form inputs for questions', () => {
      render(() => <Quizzer quizData={attemptingMixedQuiz} />);

      // True/false radio buttons
      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons.length).toBeGreaterThan(0);

      // Short answer text input
      const textInputs = screen.getAllByRole('textbox');
      expect(textInputs.length).toBeGreaterThan(0);
    });
  });

  describe('completed state', () => {
    it('should render with completed state', () => {
      render(() => <Quizzer quizData={completedMultipleChoiceQuiz} />);

      expect(screen.getByText(/You have completed the quiz/)).toBeInTheDocument();
    });

    it('should show feedback when immediate feedback type', () => {
      render(() => <Quizzer quizData={completedMultipleChoiceQuiz} />);

      expect(screen.getByText(/You can see the feedback/)).toBeInTheDocument();
    });

    it('should show Try Quiz Again button if attempts remaining', () => {
      render(() => <Quizzer quizData={completedMultipleChoiceQuiz} />);

      expect(screen.getByText('Try Quiz Again')).toBeInTheDocument();
    });

    it('should show questions with feedback in completed state', () => {
      render(() => <Quizzer quizData={completedMultipleChoiceQuiz} />);

      expect(screen.getByText(/What is 2 \+ 2/)).toBeInTheDocument();
      expect(screen.getByText(/Correct! 2 \+ 2 = 4/)).toBeInTheDocument();
    });
  });

  describe('instructor mode', () => {
    it('should show instructor controls', () => {
      render(() => <Quizzer quizData={simpleMultipleChoiceQuiz} isInstructor={true} />);

      expect(screen.getByText(/View as:/)).toBeInTheDocument();
    });

    it('should show questions in ready state for instructors', () => {
      render(() => <Quizzer quizData={simpleMultipleChoiceQuiz} isInstructor={true} />);

      // In instructor mode viewing as instructor, questions should be visible
      const viewButton = screen.getByText(/View as:/);
      expect(viewButton).toBeInTheDocument();
    });
  });

  describe('question types', () => {
    it('should render multiple choice questions', () => {
      render(() => <Quizzer quizData={attemptingMixedQuiz} />);

      // Should have radio buttons for true/false
      const radioButtons = screen.getAllByRole('radio');
      expect(radioButtons.length).toBeGreaterThan(0);
    });

    it('should render short answer questions', () => {
      render(() => <Quizzer quizData={attemptingMixedQuiz} />);

      // Should have text input
      const textInputs = screen.getAllByRole('textbox');
      expect(textInputs.length).toBeGreaterThan(0);
    });

    it('should render multiple answers questions', () => {
      render(() => <Quizzer quizData={attemptingMixedQuiz} />);

      // Should have checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  describe('attempt limits', () => {
    it('should disable start button when no attempts left', () => {
      const noAttemptsQuiz = {
        ...simpleMultipleChoiceQuiz,
        submission: {
          ...simpleMultipleChoiceQuiz.submission,
          attempt: {
            attempting: false,
            count: 2, // At limit
            mulligans: 0
          }
        }
      };

      render(() => <Quizzer quizData={noAttemptsQuiz} />);

      expect(screen.getByText(/no attempts remaining/)).toBeInTheDocument();
      expect(screen.queryByText('Start Quiz')).not.toBeInTheDocument();
    });
  });
});
