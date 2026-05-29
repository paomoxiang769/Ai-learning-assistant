export const STUDY_QUIZ_MULTIPLE_CHOICE = "multiple choice";
export const STUDY_QUIZ_SHORT_ANSWER = "short answer";

export type StudyQuizQuestionType =
  | typeof STUDY_QUIZ_MULTIPLE_CHOICE
  | typeof STUDY_QUIZ_SHORT_ANSWER;

export type StudyQuizQuestion = {
  question: string;
  type: StudyQuizQuestionType;
  options?: string[];
  answer: string;
  explanation: string;
};

function normalizeQuestionType(value: unknown): StudyQuizQuestionType {
  if (typeof value !== "string") {
    throw new Error("Quiz question type must be a string.");
  }

  const normalizedValue = value.trim().toLowerCase();

  if (
    normalizedValue === STUDY_QUIZ_MULTIPLE_CHOICE ||
    normalizedValue === "multiple_choice" ||
    normalizedValue === "multiple-choice"
  ) {
    return STUDY_QUIZ_MULTIPLE_CHOICE;
  }

  if (
    normalizedValue === STUDY_QUIZ_SHORT_ANSWER ||
    normalizedValue === "short_answer" ||
    normalizedValue === "short-answer"
  ) {
    return STUDY_QUIZ_SHORT_ANSWER;
  }

  throw new Error(`Unsupported quiz question type: ${value}`);
}

function normalizeTextField(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Quiz question ${fieldName} is required.`);
  }

  return value.trim();
}

function normalizeOptions(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error(
      "Multiple choice quiz questions must include an options array.",
    );
  }

  const options = value
    .map((option) => normalizeTextField(option, "option"))
    .filter(Boolean);

  if (options.length < 2) {
    throw new Error(
      "Multiple choice quiz questions must include at least two options.",
    );
  }

  return options;
}

export function normalizeStudyQuizPayload(value: unknown): StudyQuizQuestion[] {
  if (!Array.isArray(value)) {
    throw new Error("Quiz response must be an array.");
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Quiz question entries must be objects.");
    }

    const candidate = item as Record<string, unknown>;
    const type = normalizeQuestionType(candidate.type);

    const normalizedQuestion = {
      question: normalizeTextField(candidate.question, "question"),
      type,
      answer: normalizeTextField(candidate.answer, "answer"),
      explanation: normalizeTextField(candidate.explanation, "explanation"),
    } as StudyQuizQuestion;

    if (type === STUDY_QUIZ_MULTIPLE_CHOICE) {
      normalizedQuestion.options = normalizeOptions(candidate.options);
    }

    return normalizedQuestion;
  });
}
