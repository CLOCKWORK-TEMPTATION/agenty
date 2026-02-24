import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardHeader({ children, className, ...props }: CardHeaderProps) {
  return (
    <div className={cn('run-card-header', className)} {...props}>
      {children}
    </div>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({ children, className, ...props }: CardBodyProps) {
  return (
    <div className={cn('run-card-body', className)} {...props}>
      {children}
    </div>
  );
}

interface CardActionsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardActions({
  children,
  className,
  ...props
}: CardActionsProps) {
  return (
    <div className={cn('run-card-actions', className)} {...props}>
      {children}
    </div>
  );
}
