export type LocalModelSelectionTarget = Readonly<{
  providerId: string
  modelId: string
}>

export const isLocalModelSelectionPending = (
  target: LocalModelSelectionTarget | null,
  providerId: string,
  modelId: string
): boolean => {
  return target?.providerId === providerId && target.modelId === modelId
}
