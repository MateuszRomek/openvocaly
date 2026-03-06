export class DownloadProgressStore<
  TModelId extends string,
  TProgress extends { modelId: TModelId }
> {
  private readonly progressByModel = new Map<TModelId, TProgress>()

  get(modelId: TModelId): TProgress | undefined {
    return this.progressByModel.get(modelId)
  }

  set(progress: TProgress): void {
    this.progressByModel.set(progress.modelId, progress)
  }
}
