import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN || 'http://localhost:4200', credentials: true },
  namespace: '/events',
})
export class NexusGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NexusGateway.name);

  afterInit() {
    this.logger.log('WebSocket gateway initialised on /events');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Push a platform event to all connected clients. */
  emit(event: string, payload: unknown) {
    this.server?.emit(event, payload);
  }

  /** Broadcast a sync-started event (called by connectors service). */
  syncStarted(connectorName: string) {
    this.emit('sync:started', { connector: connectorName, ts: new Date().toISOString() });
  }

  /** Broadcast a sync-completed event. */
  syncCompleted(connectorName: string, records: number) {
    this.emit('sync:completed', { connector: connectorName, records, ts: new Date().toISOString() });
  }

  /** Broadcast a new pending approval. */
  newApproval(title: string) {
    this.emit('approval:new', { title, ts: new Date().toISOString() });
  }

  /** Broadcast an alert. */
  alert(severity: 'info' | 'warning' | 'error', message: string) {
    this.emit('alert', { severity, message, ts: new Date().toISOString() });
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: any) {
    return { event: 'pong', data };
  }
}
