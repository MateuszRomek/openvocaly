type GetLocalModelCardActionsCountInput = {
  isDownloaded: boolean
  isSelected: boolean
  isDownloading: boolean
}

export const getLocalModelCardActionsCount = ({
  isDownloaded,
  isSelected,
  isDownloading
}: GetLocalModelCardActionsCountInput): number => {
  if (isDownloaded) {
    return isSelected ? 1 : 2
  }

  return isDownloading ? 2 : 1
}
