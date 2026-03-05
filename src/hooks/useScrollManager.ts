import { useState, useEffect, useCallback, RefObject } from 'react';

export function useScrollManager(containerRef: RefObject<HTMLDivElement>) {
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const shouldShow = scrollTop > 300;
      setShowScrollTop(shouldShow);
    };

    // Check initial scroll position
    handleScroll();

    // Attach scroll listener
    container.addEventListener('scroll', handleScroll);

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []); // Empty deps - run once on mount

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [containerRef]);

  const scrollToElement = useCallback((elementId: string) => {
    const element = document.getElementById(elementId);
    if (element && containerRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [containerRef]);

  return {
    showScrollTop,
    scrollToTop,
    scrollToElement,
  };
}
