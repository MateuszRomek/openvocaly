import mitt, { type Handler } from 'mitt'
import type { EventBusEvents } from './event-bus-events'

/**
 * Typed in-process event bus used to decouple main-process feature modules.
 */
export class EventBus {
  private static readonly bus = mitt<EventBusEvents>()

  static on<Key extends keyof EventBusEvents>(
    type: Key,
    handler: Handler<EventBusEvents[Key]>
  ): typeof EventBus {
    this.bus.on(type, handler)
    return this
  }

  static off<Key extends keyof EventBusEvents>(
    type: Key,
    handler: Handler<EventBusEvents[Key]>
  ): typeof EventBus {
    this.bus.off(type, handler)
    return this
  }

  static once<Key extends keyof EventBusEvents>(
    type: Key,
    handler: Handler<EventBusEvents[Key]>
  ): typeof EventBus {
    const wrapped: Handler<EventBusEvents[Key]> = (event) => {
      handler(event)
      this.bus.off(type, wrapped)
    }

    this.bus.on(type, wrapped)
    return this
  }

  static emit<Key extends keyof EventBusEvents>(
    type: Key,
    event: EventBusEvents[Key]
  ): typeof EventBus {
    this.bus.emit(type, event)
    return this
  }
}
