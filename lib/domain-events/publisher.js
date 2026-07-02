const publishedDomainEvents = [];

export class DomainEventPublisher {
  async publish(eventName, payload = {}) {
    const event = {
      eventName,
      payload,
      createdAt: new Date().toISOString(),
    };

    publishedDomainEvents.push(event);
    console.log('[DomainEventPublisher]', {
      eventName,
      payload,
    });
  }
}

export const domainEventPublisher = new DomainEventPublisher();

export function getPublishedDomainEvents() {
  return [...publishedDomainEvents];
}

export function clearPublishedDomainEvents() {
  publishedDomainEvents.length = 0;
}
