import { useState, useEffect } from 'react';

export function useTypewriter(texts: string[], typingSpeed = 50, pauseMs = 2000) {
    const [displayText, setDisplayText] = useState('');
    const [textIndex, setTextIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const currentText = texts[textIndex];
        if (!currentText) return;

        if (!isDeleting && charIndex < currentText.length) {
            const timeout = setTimeout(() => {
                setDisplayText(currentText.slice(0, charIndex + 1));
                setCharIndex(charIndex + 1);
            }, typingSpeed);
            return () => clearTimeout(timeout);
        }

        if (!isDeleting && charIndex === currentText.length) {
            const timeout = setTimeout(() => setIsDeleting(true), pauseMs);
            return () => clearTimeout(timeout);
        }

        if (isDeleting && charIndex > 0) {
            const timeout = setTimeout(() => {
                setDisplayText(currentText.slice(0, charIndex - 1));
                setCharIndex(charIndex - 1);
            }, typingSpeed / 2);
            return () => clearTimeout(timeout);
        }

        if (isDeleting && charIndex === 0) {
            setIsDeleting(false);
            setTextIndex((textIndex + 1) % texts.length);
        }
    }, [charIndex, isDeleting, textIndex, texts, typingSpeed, pauseMs]);

    return displayText;
}
