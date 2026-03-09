import type { JSX, ReactNode } from 'react'
import {
  LocalModelsControllerContext,
  type LocalModelsControllerValue
} from './local-models-controller-context'

type LocalModelsControllerProviderProps = {
  value: LocalModelsControllerValue
  children: ReactNode
}

export function LocalModelsControllerProvider({
  value,
  children
}: LocalModelsControllerProviderProps): JSX.Element {
  return (
    <LocalModelsControllerContext.Provider value={value}>
      {children}
    </LocalModelsControllerContext.Provider>
  )
}
