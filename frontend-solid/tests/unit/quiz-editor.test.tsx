/**
 * Unit tests for Quiz Editor component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';
import { QuizEditor } from '../../src/components/quizzes/QuizEditor';
import { QuizData, QuizFeedbackType, QuizPoolRandomness, QuizQuestionType } from '../../src/components/quizzes/types';

// Create a simple test quiz
const createTestQuiz = (): QuizData => ({
  assignmentId: 201,
  courseId: 1,
  userId: 1,
  instructions: {
    settings: {
      attemptLimit: 2,
      coolDown: -1,
      feedbackType: QuizFeedbackType.IMMEDIATE,
      questionsPerPage: -1,
      poolRandomness: QuizPoolRandomness.SEED,
      readingId: null
    },
    pools: [],
    questions: {
      'q1': {
        id: 'q1',
        type: QuizQuestionType.multiple_choice_question,
        body: '<p>What is 2 + 2?</p>',
        points: 1,
        answers: ['3', '4', '5', '6']
      },
      'q2': {
        id: 'q2',
        type: QuizQuestionType.multiple_choice_question,
        body: '<p>Which language?</p>',
        points: 1,
        answers: ['Java', 'Python', 'C++']
      }
    }
  },
  submission: {
    studentAnswers: {},
    attempt: {
      attempting: false,
      count: 0,
      mulligans: 0
    },
    feedback: {}
  }
});

describe('QuizEditor', () => {
  describe('Initialization', () => {
    it('should render editor with toolbar', () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      expect(screen.getByText(/Add Question/)).toBeInTheDocument();
      expect(screen.getByText(/Undo/)).toBeInTheDocument();
      expect(screen.getByText(/Redo/)).toBeInTheDocument();
      expect(screen.getByText(/Save Quiz/)).toBeInTheDocument();
    });

    it('should display existing questions', () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      // createTestQuiz() has 2 questions
      expect(screen.getByText(/2 questions/)).toBeInTheDocument();
    });

    it('should show question count', () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      expect(screen.getByText(/2 questions/)).toBeInTheDocument();
    });

    it('should disable undo/redo initially', () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const undoButton = screen.getByTitle(/Undo/);
      const redoButton = screen.getByTitle(/Redo/);
      
      expect(undoButton).toBeDisabled();
      expect(redoButton).toBeDisabled();
    });
  });

  describe('Adding Questions', () => {
    it('should add new question when Add Question clicked', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const addButton = screen.getByText(/Add Question/);
      fireEvent.click(addButton);
      
      // Should now have 3 questions
      expect(screen.getByText(/3 questions/)).toBeInTheDocument();
    });

    it('should enable undo after adding question', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const addButton = screen.getByText(/Add Question/);
      fireEvent.click(addButton);
      
      const undoButton = screen.getByTitle(/Undo/);
      expect(undoButton).not.toBeDisabled();
    });

    it('should display new question in list', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const addButton = screen.getByText(/Add Question/);
      fireEvent.click(addButton);
      
      // Check for badge #3 (3rd question)
      expect(screen.getByText(/#3/)).toBeInTheDocument();
    });
  });

  describe('Deleting Questions', () => {
    it('should show delete button for each question', () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      // Should have delete buttons (trash icons)
      const deleteButtons = screen.getAllByTitle(/Delete/);
      expect(deleteButtons.length).toBe(2); // 2 questions
    });

    it('should delete question when delete button clicked', async () => {
      // Mock window.confirm
      window.confirm = vi.fn(() => true);
      
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const deleteButtons = screen.getAllByTitle(/Delete/);
      fireEvent.click(deleteButtons[0]);
      
      // Should now have 1 question
      expect(screen.getByText(/1 question$/)).toBeInTheDocument();
    });

    it('should not delete if confirm cancelled', async () => {
      // Mock window.confirm to return false
      window.confirm = vi.fn(() => false);
      
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const deleteButtons = screen.getAllByTitle(/Delete/);
      fireEvent.click(deleteButtons[0]);
      
      // Should still have 2 questions
      expect(screen.getByText(/2 questions/)).toBeInTheDocument();
    });
  });

  describe('Reordering Questions', () => {
    it('should show move up/down buttons', () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const upButtons = screen.getAllByTitle(/Move up/);
      const downButtons = screen.getAllByTitle(/Move down/);
      
      expect(upButtons.length).toBeGreaterThan(0);
      expect(downButtons.length).toBeGreaterThan(0);
    });

    it('should disable move up for first question', () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const upButtons = screen.getAllByTitle(/Move up/);
      expect(upButtons[0]).toBeDisabled();
    });

    it('should disable move down for last question', () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const downButtons = screen.getAllByTitle(/Move down/);
      expect(downButtons[downButtons.length - 1]).toBeDisabled();
    });

    it('should move question down', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      // Get first question's move down button
      const downButtons = screen.getAllByTitle(/Move down/);
      fireEvent.click(downButtons[0]);
      
      // Verify action was recorded
      expect(screen.getByText(/1 action/)).toBeInTheDocument();
    });
  });

  describe('Editing Questions', () => {
    it('should allow selecting a question', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const questionCards = screen.getAllByText(/Multiple Choice/);
      fireEvent.click(questionCards[0].closest('.card')!);
      
      // Should show question options when selected
      expect(screen.getByText(/Question Type:/)).toBeInTheDocument();
    });

    it('should show question options when selected', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const questionCards = document.querySelectorAll('.question-card');
      fireEvent.click(questionCards[0]);
      
      // Should show type selector and points input
      expect(screen.getByText(/Question Type:/)).toBeInTheDocument();
      expect(screen.getByText(/Points:/)).toBeInTheDocument();
    });

    it('should allow clicking question body to edit', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const questionBodies = document.querySelectorAll('.question-body');
      fireEvent.click(questionBodies[0]);
      
      // Should show textarea for editing
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('Changing Question Type', () => {
    it('should show type dropdown when question selected', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const questionCards = document.querySelectorAll('.question-card');
      fireEvent.click(questionCards[0]);
      
      const typeSelect = screen.getByRole('combobox', { name: /Question Type:/ });
      expect(typeSelect).toBeInTheDocument();
    });

    it('should change question type', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const questionCards = document.querySelectorAll('.question-card');
      fireEvent.click(questionCards[0]);
      
      const typeSelect = screen.getByRole('combobox', { name: /Question Type:/ });
      fireEvent.change(typeSelect, { target: { value: 'true_false_question' } });
      
      // Should record action
      expect(screen.getByText(/1 action/)).toBeInTheDocument();
    });
  });

  describe('Undo/Redo Functionality', () => {
    it('should undo add question action', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      // Add a question
      const addButton = screen.getByText(/Add Question/);
      fireEvent.click(addButton);
      expect(screen.getByText(/3 questions/)).toBeInTheDocument();
      
      // Undo
      const undoButton = screen.getByTitle(/Undo/);
      fireEvent.click(undoButton);
      
      // Should be back to 2 questions
      expect(screen.getByText(/2 questions/)).toBeInTheDocument();
    });

    it('should redo add question action', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      // Add a question
      const addButton = screen.getByText(/Add Question/);
      fireEvent.click(addButton);
      
      // Undo
      const undoButton = screen.getByTitle(/Undo/);
      fireEvent.click(undoButton);
      
      // Redo
      const redoButton = screen.getByTitle(/Redo/);
      fireEvent.click(redoButton);
      
      // Should have 3 questions again
      expect(screen.getByText(/3 questions/)).toBeInTheDocument();
    });

    it('should undo delete action', async () => {
      window.confirm = vi.fn(() => true);
      
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      // Delete a question
      const deleteButtons = screen.getAllByTitle(/Delete/);
      fireEvent.click(deleteButtons[0]);
      expect(screen.getByText(/1 question$/)).toBeInTheDocument();
      
      // Undo
      const undoButton = screen.getByTitle(/Undo/);
      fireEvent.click(undoButton);
      
      // Should have 2 questions again
      expect(screen.getByText(/2 questions/)).toBeInTheDocument();
    });

    it('should clear redo stack when new action performed', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      // Add a question
      const addButton = screen.getByText(/Add Question/);
      fireEvent.click(addButton);
      
      // Undo
      const undoButton = screen.getByTitle(/Undo/);
      fireEvent.click(undoButton);
      
      // Redo should be enabled
      const redoButton = screen.getByTitle(/Redo/);
      expect(redoButton).not.toBeDisabled();
      
      // Perform new action
      fireEvent.click(addButton);
      
      // Redo should be disabled
      expect(redoButton).toBeDisabled();
    });
  });

  describe('Save Functionality', () => {
    it('should call onSave when save clicked', async () => {
      const onSave = vi.fn();
      render(() => <QuizEditor quizData={createTestQuiz()} onSave={onSave} />);
      
      const saveButton = screen.getByText(/Save Quiz/);
      fireEvent.click(saveButton);
      
      expect(onSave).toHaveBeenCalled();
    });

    it('should pass updated quiz data to onSave', async () => {
      const onSave = vi.fn();
      render(() => <QuizEditor quizData={createTestQuiz()} onSave={onSave} />);
      
      // Add a question
      const addButton = screen.getByText(/Add Question/);
      fireEvent.click(addButton);
      
      // Save
      const saveButton = screen.getByText(/Save Quiz/);
      fireEvent.click(saveButton);
      
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: expect.objectContaining({
            questions: expect.any(Object)
          })
        })
      );
    });
  });

  describe('Action History', () => {
    it('should show action count', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      // Initially 0 actions
      expect(screen.getByText(/0 actions in history/)).toBeInTheDocument();
      
      // Add a question
      const addButton = screen.getByText(/Add Question/);
      fireEvent.click(addButton);
      
      // Should show 1 action
      expect(screen.getByText(/1 action in history/)).toBeInTheDocument();
    });

    it('should update action count after multiple actions', async () => {
      render(() => <QuizEditor quizData={createTestQuiz()} />);
      
      const addButton = screen.getByText(/Add Question/);
      
      // Add 3 questions
      fireEvent.click(addButton);
      fireEvent.click(addButton);
      fireEvent.click(addButton);
      
      // Should show 3 actions
      expect(screen.getByText(/3 actions in history/)).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show message when no questions', () => {
      const emptyQuiz = createTestQuiz();
      emptyQuiz.instructions.questions = {};
      
      render(() => <QuizEditor quizData={emptyQuiz} />);
      
      expect(screen.getByText(/No questions yet/)).toBeInTheDocument();
    });
  });
});
