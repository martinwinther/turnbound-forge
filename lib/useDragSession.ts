"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Point, Rotation } from "@/lib/types";

type RotateDirection = "cw" | "ccw";

type DragAnchor = Point | null;
type DragKind = "none" | "library" | "placed" | "hero";
type DragOrigin = {
  x: number;
  y: number;
  rot: Rotation;
} | null;

export type DragSessionState = {
  isDragging: boolean;
  dragKind: DragKind;
  dragItemId: string | null;
  dragInstanceId: string | null;
  origin: DragOrigin;
  dragGrabOffset: Point;
  pointer: Point;
  anchor: DragAnchor;
  rot: Rotation;
};

type UseDragSessionOptions = {
  resolvePlacedDrag?: (instanceId: string) => {
    itemId: string;
    origin: { x: number; y: number; rot: Rotation };
  } | null;
  onPointerUp?: (state: DragSessionState, event: PointerEvent) => void;
};

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

const rotate = (current: Rotation, direction: RotateDirection): Rotation => {
  const currentIndex = ROTATIONS.indexOf(current);
  if (currentIndex < 0) {
    return 0;
  }

  const offset = direction === "cw" ? 1 : -1;
  const nextIndex = (currentIndex + offset + ROTATIONS.length) % ROTATIONS.length;
  return ROTATIONS[nextIndex];
};

const defaultSessionState: DragSessionState = {
  isDragging: false,
  dragKind: "none",
  dragItemId: null,
  dragInstanceId: null,
  origin: null,
  dragGrabOffset: { x: 0, y: 0 },
  pointer: { x: 0, y: 0 },
  anchor: null,
  rot: 0,
};

type StartEvent = PointerEvent | React.PointerEvent;

const getPointerTarget = (event: StartEvent): Element | null => {
  if (event.currentTarget instanceof Element) {
    return event.currentTarget;
  }

  if (event.target instanceof Element) {
    return event.target;
  }

  return null;
};

const isPrimaryPointerEvent = (event: StartEvent): boolean => {
  if ("button" in event && event.button === 0) {
    return true;
  }

  if ("buttons" in event && (event.buttons & 1) === 1) {
    return true;
  }

  return false;
};

export const useDragSession = (options: UseDragSessionOptions = {}) => {
  const [session, setSession] = useState<DragSessionState>(defaultSessionState);
  const stateRef = useRef<DragSessionState>(defaultSessionState);
  const pointerTargetRef = useRef<Element | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  const lastWheelRotationAtRef = useRef(0);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    stateRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!session.isDragging) {
      lastWheelRotationAtRef.current = 0;
    }
  }, [session.isDragging]);

  const releasePointerCapture = useCallback(() => {
    const pointerId = activePointerIdRef.current;
    const pointerTarget = pointerTargetRef.current;
    if (pointerId == null || !pointerTarget) {
      return;
    }

    if ("releasePointerCapture" in pointerTarget) {
      try {
        pointerTarget.releasePointerCapture(pointerId);
      } catch {
        // Best effort only.
      }
    }
  }, []);

  const endDrag = useCallback(() => {
    releasePointerCapture();
    activePointerIdRef.current = null;
    pointerTargetRef.current = null;
    setSession((previousState) => ({
      ...previousState,
      isDragging: false,
      dragKind: "none",
      dragItemId: null,
      dragInstanceId: null,
      origin: null,
      dragGrabOffset: { x: 0, y: 0 },
      anchor: null,
      rot: 0,
    }));
  }, [releasePointerCapture]);

  const updatePointer = useCallback((event: PointerEvent | React.PointerEvent) => {
    const pointer = { x: event.clientX, y: event.clientY };
    setSession((previousState) => ({
      ...previousState,
      pointer,
    }));
  }, []);

  const rotateDrag = useCallback((direction: RotateDirection) => {
    setSession((previousState) => {
      if (!previousState.isDragging) {
        return previousState;
      }
      return {
        ...previousState,
        rot: rotate(previousState.rot, direction),
      };
    });
  }, []);

  const setAnchor = useCallback((anchor: DragAnchor) => {
    setSession((previousState) => ({
      ...previousState,
      anchor,
    }));
  }, []);

  const startLibraryDrag = useCallback((itemId: string, startEvent: StartEvent) => {
    if (!isPrimaryPointerEvent(startEvent)) {
      return;
    }

    const pointer = { x: startEvent.clientX, y: startEvent.clientY };
    const pointerTarget = getPointerTarget(startEvent);
    pointerTargetRef.current = pointerTarget;
    activePointerIdRef.current = startEvent.pointerId;

    if (pointerTarget && "setPointerCapture" in pointerTarget) {
      try {
        pointerTarget.setPointerCapture(startEvent.pointerId);
      } catch {
        // Best effort only.
      }
    }

    setSession({
      isDragging: true,
      dragKind: "library",
      dragItemId: itemId,
      dragInstanceId: null,
      origin: null,
      dragGrabOffset: { x: 0, y: 0 },
      pointer,
      anchor: null,
      rot: 0,
    });
  }, []);

  const startPlacedDrag = useCallback(
    (instanceId: string, startEvent: StartEvent, grabbedCell?: Point) => {
      if (!isPrimaryPointerEvent(startEvent)) {
        return;
      }

      const placed = optionsRef.current.resolvePlacedDrag?.(instanceId);
      if (!placed) {
        return;
      }

      const pointer = { x: startEvent.clientX, y: startEvent.clientY };
      const pointerTarget = getPointerTarget(startEvent);
      pointerTargetRef.current = pointerTarget;
      activePointerIdRef.current = startEvent.pointerId;

      if (pointerTarget && "setPointerCapture" in pointerTarget) {
        try {
          pointerTarget.setPointerCapture(startEvent.pointerId);
        } catch {
          // Best effort only.
        }
      }

      const dragGrabOffset =
        grabbedCell == null
          ? { x: 0, y: 0 }
          : {
              x: grabbedCell.x - placed.origin.x,
              y: grabbedCell.y - placed.origin.y,
            };

      setSession({
        isDragging: true,
        dragKind: "placed",
        dragItemId: placed.itemId,
        dragInstanceId: instanceId,
        origin: placed.origin,
        dragGrabOffset,
        pointer,
        anchor: null,
        rot: placed.origin.rot,
      });
    },
    [],
  );

  const startHeroDrag = useCallback((startEvent: StartEvent, grabbedCell?: Point) => {
    if (!isPrimaryPointerEvent(startEvent)) {
      return;
    }

    const pointer = { x: startEvent.clientX, y: startEvent.clientY };
    const pointerTarget = getPointerTarget(startEvent);
    pointerTargetRef.current = pointerTarget;
    activePointerIdRef.current = startEvent.pointerId;

    if (pointerTarget && "setPointerCapture" in pointerTarget) {
      try {
        pointerTarget.setPointerCapture(startEvent.pointerId);
      } catch {
        // Best effort only.
      }
    }

    setSession({
      isDragging: true,
      dragKind: "hero",
      dragItemId: null,
      dragInstanceId: null,
      origin: null,
      dragGrabOffset: grabbedCell == null ? { x: 0, y: 0 } : grabbedCell,
      pointer,
      anchor: null,
      rot: 0,
    });
  }, []);

  useEffect(() => {
    if (!session.isDragging) {
      return;
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (
        activePointerIdRef.current != null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      updatePointer(event);
    };

    const handleWindowPointerUp = (event: PointerEvent) => {
      if (
        activePointerIdRef.current != null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      updatePointer(event);
      optionsRef.current.onPointerUp?.(stateRef.current, event);
      endDrag();
    };

    const handleWindowPointerCancel = (event: PointerEvent) => {
      if (
        activePointerIdRef.current != null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      endDrag();
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerCancel);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerCancel);
    };
  }, [endDrag, session.isDragging, updatePointer]);

  useEffect(() => {
    if (!session.isDragging) {
      return;
    }

    const WHEEL_ROTATION_THROTTLE_MS = 100;
    const handleWheel = (event: WheelEvent) => {
      if (!stateRef.current.isDragging || event.deltaY === 0) {
        return;
      }

      event.preventDefault();
      const now = Date.now();
      if (now - lastWheelRotationAtRef.current < WHEEL_ROTATION_THROTTLE_MS) {
        return;
      }

      lastWheelRotationAtRef.current = now;
      rotateDrag(event.deltaY > 0 ? "cw" : "ccw");
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [rotateDrag, session.isDragging]);

  useEffect(() => {
    return () => {
      releasePointerCapture();
    };
  }, [releasePointerCapture]);

  return {
    ...session,
    startLibraryDrag,
    startPlacedDrag,
    startHeroDrag,
    updatePointer,
    endDrag,
    rotateDrag,
    setAnchor,
  };
};
