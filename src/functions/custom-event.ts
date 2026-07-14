import type { FunctionResponse } from '@salla.sa/app-functions-types';

export const customEvent = (context: unknown): FunctionResponse => {
  const event = context as { name: string };
  return {
    success: true,
    status: 200,
    message: `Custom event "${event.name}" processed successfully.`,
    data: {}
  };
};
