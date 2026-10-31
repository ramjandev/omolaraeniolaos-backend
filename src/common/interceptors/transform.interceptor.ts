import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    if (context.getType() !== 'http') {
      return next.handle() as Observable<ApiResponse<T>>;
    }
    const response = context.switchToHttp().getResponse();
    const statusCode = response.statusCode || 200;

    const customMessage = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data) => {
        let message = customMessage || 'Request processed successfully';
        let responseData = data;

        // If service returns an object with custom message and data properties, extract gracefully
        if (
          data &&
          typeof data === 'object' &&
          'message' in data &&
          'data' in data &&
          Object.keys(data).length <= 3
        ) {
          message = data.message || message;
          responseData = data.data;
        }

        return {
          statusCode,
          success: true,
          message,
          data: responseData !== undefined ? responseData : null,
        };
      }),
    );
  }
}
