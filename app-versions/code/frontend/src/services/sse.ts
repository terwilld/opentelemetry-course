import type { Response } from 'express';

export interface SSEConnection {
  res: Response;
  sessionId: string;
}

export class SSEManager {
  private connections: Map<string, Set<Response>>;

  constructor() {
    this.connections = new Map();
  }

  addConnection(sessionId: string, res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering

    // Send initial comment to establish connection
    res.write(':ok\n\n');

    // Add to connections map
    if (!this.connections.has(sessionId)) {
      this.connections.set(sessionId, new Set());
    }
    this.connections.get(sessionId)!.add(res);

    // Handle client disconnect
    res.on('close', () => {
      this.removeConnection(sessionId, res);
    });

    console.log(`SSE connection added for session ${sessionId}`);
  }

  sendEvent(sessionId: string, event: string, data: unknown): void {
    const connections = this.connections.get(sessionId);

    if (!connections || connections.size === 0) {
      return;
    }

    const dataStr = JSON.stringify(data);
    const message = `event: ${event}\ndata: ${dataStr}\n\n`;

    // Send to all connections for this session
    for (const res of connections) {
      try {
        res.write(message);
      } catch (error) {
        console.error('Error writing to SSE connection:', error);
        this.removeConnection(sessionId, res);
      }
    }

    console.log(
      `Sent ${event} event to ${connections.size} connection(s) for session ${sessionId}`,
    );
  }

  removeConnection(sessionId: string, res: Response): void {
    const connections = this.connections.get(sessionId);

    if (connections) {
      connections.delete(res);

      if (connections.size === 0) {
        this.connections.delete(sessionId);
      }

      console.log(`SSE connection removed for session ${sessionId}`);
    }

    // Close the response if not already closed
    if (!res.writableEnded) {
      res.end();
    }
  }

  getConnectionCount(sessionId: string): number {
    return this.connections.get(sessionId)?.size || 0;
  }

  closeAllConnections(sessionId: string): void {
    const connections = this.connections.get(sessionId);

    if (connections) {
      for (const res of connections) {
        if (!res.writableEnded) {
          res.end();
        }
      }
      this.connections.delete(sessionId);
      console.log(`Closed all SSE connections for session ${sessionId}`);
    }
  }

  closeAll(): void {
    for (const [sessionId, connections] of this.connections.entries()) {
      for (const res of connections) {
        if (!res.writableEnded) {
          res.end();
        }
      }
    }
    this.connections.clear();
    console.log('Closed all SSE connections');
  }
}
