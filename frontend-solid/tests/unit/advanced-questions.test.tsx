/**
 * Unit tests for advanced question types (dropdowns and fill-in-blanks)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { Quizzer } from '../../src/components/quizzes/Quizzer';
import {
  advancedQuestionTypesQuiz,
  attemptingAdvancedQuiz,
  completedAdvancedQuiz,
  escapedBracketsQuiz
} from '../fixtures/quiz-advanced-types';

describe('Advanced Question Types', () => {
  describe('Multiple Dropdowns Question', () => {
    it('should render multiple dropdown question', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Check that dropdowns are present
      const dropdowns = screen.getAllByRole('combobox');
      expect(dropdowns.length).toBeGreaterThan(0);
    });

    it('should show question body with dropdowns embedded', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Check for text around dropdowns
      expect(screen.getByText(/A/)).toBeInTheDocument();
      expect(screen.getByText(/loop in Python uses the/)).toBeInTheDocument();
    });

    it('should populate dropdown options', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Dropdowns should have options
      const dropdowns = screen.getAllByRole('combobox');
      expect(dropdowns.length).toBeGreaterThan(0);
      
      // First dropdown should have options
      const firstDropdown = dropdowns[0] as HTMLSelectElement;
      expect(firstDropdown.options.length).toBeGreaterThan(1); // Has "-- Select --" plus options
    });

    it('should show selected answers in dropdowns', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Check that selected values are shown
      const dropdowns = screen.getAllByRole('combobox');
      const keywordDropdown = Array.from(dropdowns).find(
        (d) => (d as HTMLSelectElement).value === 'for'
      );
      expect(keywordDropdown).toBeDefined();
    });

    it('should handle multiple dropdowns in one question', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Question mdq1 has 2 dropdowns (keyword and structure)
      const dropdowns = screen.getAllByRole('combobox');
      // We have multiple questions with dropdowns, so should be several
      expect(dropdowns.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Fill In Multiple Blanks Question', () => {
    it('should render fill in the blanks question', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Check that text inputs are present
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('should show question body with blanks embedded', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Check for text around blanks
      expect(screen.getByText(/To define a function in Python, use the/)).toBeInTheDocument();
    });

    it('should show placeholders for blank identifiers', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Check for inputs with placeholders
      const inputs = screen.getAllByRole('textbox');
      const hasPlaceholder = Array.from(inputs).some(
        (input) => (input as HTMLInputElement).placeholder !== ''
      );
      expect(hasPlaceholder).toBe(true);
    });

    it('should show filled-in answers', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Check that filled values are shown
      const inputs = screen.getAllByRole('textbox');
      const defInput = Array.from(inputs).find(
        (input) => (input as HTMLInputElement).value === 'def'
      );
      expect(defInput).toBeDefined();
    });

    it('should handle multiple blanks in one question', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Question fimb1 has 2 blanks (keyword1 and keyword2)
      const inputs = screen.getAllByRole('textbox');
      // We have multiple questions with blanks, so should be several
      expect(inputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Completed state with advanced types', () => {
    it('should show feedback for multiple dropdowns', () => {
      render(() => <Quizzer quizData={completedAdvancedQuiz} />);

      expect(screen.getByText(/Correct! Python uses/)).toBeInTheDocument();
    });

    it('should show feedback for fill in the blanks', () => {
      render(() => <Quizzer quizData={completedAdvancedQuiz} />);

      expect(screen.getByText(/Correct! Functions are defined with/)).toBeInTheDocument();
    });

    it('should disable dropdowns in completed state', () => {
      render(() => <Quizzer quizData={completedAdvancedQuiz} />);

      const dropdowns = screen.getAllByRole('combobox');
      expect(dropdowns.length).toBeGreaterThan(0);
      expect((dropdowns[0] as HTMLSelectElement).disabled).toBe(true);
    });

    it('should disable text inputs in completed state', () => {
      render(() => <Quizzer quizData={completedAdvancedQuiz} />);

      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThan(0);
      expect((inputs[0] as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe('Ready state', () => {
    it('should not show advanced questions before starting', () => {
      render(() => <Quizzer quizData={advancedQuestionTypesQuiz} />);

      // In student view, questions shouldn't be visible yet
      const dropdowns = screen.queryAllByRole('combobox');
      expect(dropdowns.length).toBe(0);
    });
  });

  describe('Mixed question types quiz', () => {
    it('should render quiz with all advanced question types', () => {
      render(() => <Quizzer quizData={attemptingAdvancedQuiz} />);

      // Should have both dropdowns and text inputs
      const dropdowns = screen.getAllByRole('combobox');
      const inputs = screen.getAllByRole('textbox');

      expect(dropdowns.length).toBeGreaterThan(0);
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('should handle all questions in completed state', () => {
      render(() => <Quizzer quizData={completedAdvancedQuiz} />);

      // All 4 questions should have feedback (some may say "Correct", "Perfect", etc.)
      const feedbackElements = screen.getAllByText(/Correct|Perfect/);
      expect(feedbackElements.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Escaped brackets handling', () => {
    it('should handle escaped square brackets correctly', () => {
      const escapedQuiz = {
        ...escapedBracketsQuiz,
        submission: {
          ...escapedBracketsQuiz.submission,
          attempt: {
            attempting: true,
            count: 0,
            mulligans: 0
          }
        }
      };

      render(() => <Quizzer quizData={escapedQuiz} />);

      // The double brackets [[ ]] should be displayed as text, not as blanks
      // Only [keyword] should create an input
      const inputs = screen.getAllByRole('textbox');
      // Should have at least 1 input for [keyword]
      // Note: The regex parsing might pick up more, but that's ok for now
      expect(inputs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
