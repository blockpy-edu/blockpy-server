/**
 * Unit tests for Quiz model
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Quiz } from '../../src/components/quizzes/Quiz';
import { QuizMode, QuizFeedbackType } from '../../src/components/quizzes/types';
import { simpleMultipleChoiceQuiz, completedMultipleChoiceQuiz } from '../fixtures/quiz-multiple-choice';

describe('Quiz Model', () => {
  describe('initialization', () => {
    it('should create a quiz with initial state', () => {
      const quiz = new Quiz(simpleMultipleChoiceQuiz);

      expect(quiz.attempting()).toBe(false);
      expect(quiz.attemptCount()).toBe(0);
      expect(quiz.attemptStatus).toBe(QuizMode.READY);
    });

    it('should create a quiz with completed state', () => {
      const quiz = new Quiz(completedMultipleChoiceQuiz);

      expect(quiz.attempting()).toBe(false);
      expect(quiz.attemptCount()).toBe(1);
      expect(quiz.attemptStatus).toBe(QuizMode.COMPLETED);
    });
  });

  describe('attempt management', () => {
    let quiz: Quiz;

    beforeEach(() => {
      quiz = new Quiz(simpleMultipleChoiceQuiz);
    });

    it('should start quiz', () => {
      quiz.startQuiz();

      expect(quiz.attempting()).toBe(true);
      expect(quiz.attemptStatus).toBe(QuizMode.ATTEMPTING);
    });

    it('should submit quiz', () => {
      quiz.startQuiz();
      quiz.submitQuiz();

      expect(quiz.attempting()).toBe(false);
      expect(quiz.attemptCount()).toBe(1);
      expect(quiz.attemptStatus).toBe(QuizMode.COMPLETED);
    });

    it('should clear answers when starting new attempt', () => {
      quiz.startQuiz();
      quiz.submitAnswer('q1', '4');
      expect(quiz.studentAnswers()['q1']).toBe('4');

      quiz.submitQuiz();
      quiz.startQuiz();

      expect(Object.keys(quiz.studentAnswers()).length).toBe(0);
    });

    it('should check if can attempt based on limit', () => {
      expect(quiz.canAttempt()).toBe(true);

      quiz.startQuiz();
      quiz.submitQuiz();
      expect(quiz.canAttempt()).toBe(true);

      quiz.startQuiz();
      quiz.submitQuiz();
      expect(quiz.canAttempt()).toBe(false); // limit is 2
    });

    it('should allow infinite attempts when limit is -1', () => {
      const unlimitedQuiz = new Quiz({
        ...simpleMultipleChoiceQuiz,
        instructions: {
          ...simpleMultipleChoiceQuiz.instructions,
          settings: {
            ...simpleMultipleChoiceQuiz.instructions.settings!,
            attemptLimit: -1
          }
        }
      });

      for (let i = 0; i < 10; i++) {
        expect(unlimitedQuiz.canAttempt()).toBe(true);
        unlimitedQuiz.startQuiz();
        unlimitedQuiz.submitQuiz();
      }
    });
  });

  describe('answer submission', () => {
    let quiz: Quiz;

    beforeEach(() => {
      quiz = new Quiz(simpleMultipleChoiceQuiz);
      quiz.startQuiz();
    });

    it('should submit answer for a question', () => {
      quiz.submitAnswer('q1', '4');

      expect(quiz.studentAnswers()['q1']).toBe('4');
    });

    it('should update answer for a question', () => {
      quiz.submitAnswer('q1', '3');
      expect(quiz.studentAnswers()['q1']).toBe('3');

      quiz.submitAnswer('q1', '4');
      expect(quiz.studentAnswers()['q1']).toBe('4');
    });

    it('should submit multiple answers', () => {
      quiz.submitAnswer('q1', '4');
      quiz.submitAnswer('q2', 'Python');
      quiz.submitAnswer('q3', 'Hello');

      expect(quiz.studentAnswers()['q1']).toBe('4');
      expect(quiz.studentAnswers()['q2']).toBe('Python');
      expect(quiz.studentAnswers()['q3']).toBe('Hello');
    });
  });

  describe('properties and computed values', () => {
    it('should return correct feedback type', () => {
      const quiz = new Quiz(simpleMultipleChoiceQuiz);
      expect(quiz.feedbackType).toBe(QuizFeedbackType.IMMEDIATE);
    });

    it('should return attempt limit', () => {
      const quiz = new Quiz(simpleMultipleChoiceQuiz);
      expect(quiz.attemptLimit).toBe(2);
    });

    it('should format attempts left message correctly', () => {
      const quiz = new Quiz(simpleMultipleChoiceQuiz);

      expect(quiz.attemptsLeft).toBe('2 attempts remaining');

      quiz.startQuiz();
      quiz.submitQuiz();
      expect(quiz.attemptsLeft).toBe('1 attempt remaining');

      quiz.startQuiz();
      quiz.submitQuiz();
      expect(quiz.attemptsLeft).toBe('no attempts remaining');
    });

    it('should handle infinite attempts message', () => {
      const quiz = new Quiz({
        ...simpleMultipleChoiceQuiz,
        instructions: {
          ...simpleMultipleChoiceQuiz.instructions,
          settings: {
            ...simpleMultipleChoiceQuiz.instructions.settings!,
            attemptLimit: -1
          }
        }
      });

      expect(quiz.attemptsLeft).toBe('0 attempts so far');

      quiz.startQuiz();
      quiz.submitQuiz();
      expect(quiz.attemptsLeft).toBe('1 attempt so far');
    });
  });

  describe('questions', () => {
    let quiz: Quiz;

    beforeEach(() => {
      quiz = new Quiz(simpleMultipleChoiceQuiz);
    });

    it('should return all questions', () => {
      const questions = quiz.getQuestions();
      expect(questions.length).toBe(3);
    });

    it('should get specific question by id', () => {
      const question = quiz.getQuestion('q1');
      expect(question).toBeDefined();
      expect(question?.body).toContain('2 + 2');
    });

    it('should return undefined for non-existent question', () => {
      const question = quiz.getQuestion('nonexistent');
      expect(question).toBeUndefined();
    });
  });

  describe('serialization', () => {
    it('should serialize to submission JSON', () => {
      const quiz = new Quiz(simpleMultipleChoiceQuiz);
      quiz.startQuiz();
      quiz.submitAnswer('q1', '4');

      const json = quiz.toSubmissionJSON();

      expect(json.studentAnswers).toEqual({ 'q1': '4' });
      expect(json.attempt?.attempting).toBe(true);
      expect(json.attempt?.count).toBe(0);
    });
  });
});
