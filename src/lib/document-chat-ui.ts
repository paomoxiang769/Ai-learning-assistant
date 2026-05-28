type DocumentChatViewModelInput = {
  canAsk: boolean;
  isSubmitting: boolean;
  messageCount: number;
};

type DocumentChatViewModel = {
  disableAsk: boolean;
  showEmptyState: boolean;
  showThinkingState: boolean;
};

export function getDocumentChatViewModel(
  input: DocumentChatViewModelInput,
): DocumentChatViewModel {
  return {
    disableAsk: !input.canAsk || input.isSubmitting,
    showEmptyState: input.messageCount === 0,
    showThinkingState: input.isSubmitting,
  };
}

export function getSourcesSummaryLabel(sourceCount: number) {
  return `Sources (${sourceCount})`;
}

export type { DocumentChatViewModel, DocumentChatViewModelInput };
