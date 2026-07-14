/**
 * Test fixture: Multiple dropdowns and fill in the blanks questions
 * Scenario: Advanced question types with embedded inputs
 */

import { QuizData, QuizQuestionType, QuizFeedbackType, QuizPoolRandomness } from '../../src/components/quizzes/types';

export const advancedQuestionTypesQuiz: QuizData = {
  assignmentId: 203,
  courseId: 1,
  userId: 3,
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
      'mdq1': {
        id: 'mdq1',
        type: QuizQuestionType.multiple_dropdowns_question,
        body: '<p>A <code>for</code> loop in Python uses the [keyword] keyword to iterate over [structure].</p>',
        points: 2,
        retainOrder: false,
        answers: {
          'keyword': ['for', 'while', 'if', 'def'],
          'structure': ['sequences', 'integers', 'strings', 'functions']
        }
      },
      'fimb1': {
        id: 'fimb1',
        type: QuizQuestionType.fill_in_multiple_blanks_question,
        body: '<p>To define a function in Python, use the [keyword1] keyword followed by the function [keyword2] and parentheses.</p>',
        points: 2
      },
      'mdq2': {
        id: 'mdq2',
        type: QuizQuestionType.multiple_dropdowns_question,
        body: '<p>The data type for whole numbers is [type1], while decimal numbers use [type2], and text uses [type3].</p>',
        points: 3,
        retainOrder: true,
        answers: {
          'type1': ['int', 'float', 'str', 'bool'],
          'type2': ['float', 'int', 'str', 'decimal'],
          'type3': ['str', 'string', 'text', 'char']
        }
      },
      'fimb2': {
        id: 'fimb2',
        type: QuizQuestionType.fill_in_multiple_blanks_question,
        body: '<p>To print output in Python, use <code>[function]()</code>. To get user input, use <code>[input_func]()</code>.</p>',
        points: 2
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
};

export const attemptingAdvancedQuiz: QuizData = {
  ...advancedQuestionTypesQuiz,
  submission: {
    studentAnswers: {
      'mdq1': {
        'keyword': 'for',
        'structure': 'sequences'
      },
      'fimb1': {
        'keyword1': 'def',
        'keyword2': 'name'
      }
    },
    attempt: {
      attempting: true,
      count: 0,
      mulligans: 0
    },
    feedback: {}
  }
};

export const completedAdvancedQuiz: QuizData = {
  ...advancedQuestionTypesQuiz,
  submission: {
    studentAnswers: {
      'mdq1': {
        'keyword': 'for',
        'structure': 'sequences'
      },
      'fimb1': {
        'keyword1': 'def',
        'keyword2': 'name'
      },
      'mdq2': {
        'type1': 'int',
        'type2': 'float',
        'type3': 'str'
      },
      'fimb2': {
        'function': 'print',
        'input_func': 'input'
      }
    },
    attempt: {
      attempting: false,
      count: 1,
      mulligans: 0
    },
    feedback: {
      'mdq1': {
        correct: true,
        message: 'Correct! Python uses <code>for</code> loops to iterate over sequences.',
        score: 2
      },
      'fimb1': {
        correct: true,
        message: 'Correct! Functions are defined with <code>def</code> followed by the function name.',
        score: 2
      },
      'mdq2': {
        correct: true,
        message: 'Perfect! You correctly identified int, float, and str.',
        score: 3
      },
      'fimb2': {
        correct: true,
        message: 'Correct! <code>print()</code> for output and <code>input()</code> for input.',
        score: 2
      }
    }
  }
};

// Example with escaped square brackets
export const escapedBracketsQuiz: QuizData = {
  assignmentId: 204,
  courseId: 1,
  userId: 4,
  instructions: {
    settings: {
      attemptLimit: 1,
      coolDown: -1,
      feedbackType: QuizFeedbackType.IMMEDIATE,
      questionsPerPage: -1,
      poolRandomness: QuizPoolRandomness.NONE,
      readingId: null
    },
    pools: [],
    questions: {
      'fimb3': {
        id: 'fimb3',
        type: QuizQuestionType.fill_in_multiple_blanks_question,
        body: '<p>To access a list element, use [[square brackets]] like <code>my_list[0]</code>. The [keyword] statement adds items to a list.</p>',
        points: 1
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
};
