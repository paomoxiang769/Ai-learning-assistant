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

export type SavedStudyQuiz = {
  id: string;
  documentId: string;
  title: string | null;
  quiz: StudyQuizQuestion[];
  questionCount: number;
  createdAt: string;
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

export function normalizeStoredStudyQuizPayload(value: unknown): StudyQuizQuestion[] {
  if (Array.isArray(value)) {
    return normalizeStudyQuizPayload(value);
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;

    if (Array.isArray(candidate.quiz)) {
      return normalizeStudyQuizPayload(candidate.quiz);
    }

    if (Array.isArray(candidate.questions)) {
      return normalizeStudyQuizPayload(candidate.questions);
    }
  }

  return normalizeStudyQuizPayload(value);
}

function normalizeNullableTextField(value: unknown, fieldName: string) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`Saved quiz ${fieldName} must be a string or null.`);
  }

  return value;
}

export function normalizeSavedStudyQuizPayload(value: unknown): SavedStudyQuiz {
  if (!value || typeof value !== "object") {
    throw new Error("Saved quiz entries must be objects.");
  }

  const candidate = value as Record<string, unknown>;
  const id = normalizeTextField(candidate.id, "id");
  const documentId = normalizeTextField(candidate.documentId, "documentId");
  const quiz = normalizeStoredStudyQuizPayload(candidate.quiz);
  const createdAt = normalizeTextField(candidate.createdAt, "createdAt");
  const questionCount =
    typeof candidate.questionCount === "number" &&
    Number.isFinite(candidate.questionCount)
      ? Math.max(0, Math.floor(candidate.questionCount))
      : quiz.length;

  return {
    id,
    documentId,
    title: normalizeNullableTextField(candidate.title, "title"),
    quiz,
    questionCount,
    createdAt,
  };
}

export function normalizeSavedStudyQuizListPayload(
  value: unknown,
): SavedStudyQuiz[] {
  if (!Array.isArray(value)) {
    throw new Error("Saved quiz response must be an array.");
  }

  return value.map(normalizeSavedStudyQuizPayload);
}
