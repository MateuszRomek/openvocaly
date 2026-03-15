import { ipcMain } from 'electron'
import type {
  GetHomeAppsParams,
  GetHomeAppsResponse,
  GetHomeMonthlyOutputParams,
  GetHomeMonthlyOutputResponse,
  GetHomeRangeTimelinesParams,
  GetHomeRangeTimelinesResponse,
  GetHomeSummaryParams,
  GetHomeSummaryResponse
} from '../../shared/reporting'
import { createIpcRegistrar } from '../helpers/ipc'
import type { ReportingService } from './service'

export type ReportingIpcModule = {
  registerIpcHandlers: () => void
}

export const createReportingIpcModule = (
  reportingService: ReportingService
): ReportingIpcModule => {
  const registerIpcHandlers = createIpcRegistrar(() => {
    ipcMain.handle(
      'reporting:getHomeSummary',
      (_event, params: GetHomeSummaryParams): Promise<GetHomeSummaryResponse> =>
        reportingService.getHomeSummary(params)
    )

    ipcMain.handle(
      'reporting:getHomeRangeTimelines',
      (_event, params: GetHomeRangeTimelinesParams): Promise<GetHomeRangeTimelinesResponse> =>
        reportingService.getHomeRangeTimelines(params)
    )

    ipcMain.handle(
      'reporting:getHomeMonthlyOutput',
      (_event, params: GetHomeMonthlyOutputParams): Promise<GetHomeMonthlyOutputResponse> =>
        reportingService.getHomeMonthlyOutput(params)
    )

    ipcMain.handle(
      'reporting:getHomeApps',
      (_event, params: GetHomeAppsParams): Promise<GetHomeAppsResponse> =>
        reportingService.getHomeApps(params)
    )
  })

  return {
    registerIpcHandlers
  }
}
