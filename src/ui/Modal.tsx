import { useEffect, type ReactNode } from 'react';
import { IconClose } from './icons';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  narrow?: boolean;
  actions?: ReactNode;
}

export function Modal({ title, onClose, children, narrow, actions }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${narrow ? ' modal--narrow' : ''}`} role="dialog" aria-modal="true">
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {actions}
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <IconClose className="" />
            </button>
          </div>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
