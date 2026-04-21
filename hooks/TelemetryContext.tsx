import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RoutePoint = { latitude: number; longitude: number; altitude?: number | null };

type TelemetryContextType = {
  isTracking: boolean;
  currentLocation: RoutePoint | null;
  startLocation: RoutePoint | null;
  endLocation: RoutePoint | null;
  routePoints: RoutePoint[];
  startTrackingSession: () => Promise<void>;
  stopTrackingSession: () => Promise<void>;
};

const TelemetryContext = createContext<TelemetryContextType | null>(null);

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<RoutePoint | null>(null);
  const [startLocation, setStartLocation] = useState<RoutePoint | null>(null);
  const [endLocation, setEndLocation] = useState<RoutePoint | null>(null);
  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  
  // We use a ref to store the subscription so we can cancel it later
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const isTrackingRef = useRef(false);

  const ensureLocationSubscription = async () => {
    if (locationSubscription.current) {
      return true;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }

    const initialPos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    const initialPoint = {
      latitude: initialPos.coords.latitude,
      longitude: initialPos.coords.longitude,
      altitude: initialPos.coords.altitude,
    };

    setCurrentLocation(initialPoint);

    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, distanceInterval: 2 },
      (pos) => {
        const nextPoint = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
        };

        setCurrentLocation(nextPoint);

        if (isTrackingRef.current) {
          setRoutePoints((prev) => [...prev, nextPoint]);
        }
      }
    );

    return true;
  };

  useEffect(() => {
    ensureLocationSubscription().catch(() => {
      // Keep the app usable even if location is unavailable.
    });

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, []);

  const startTrackingSession = async () => {
    // 1. Reset old data
    setRoutePoints([]);
    setEndLocation(null);
    setIsTracking(true);
    isTrackingRef.current = true;

    const hasLocation = await ensureLocationSubscription();
    if (!hasLocation) {
      setIsTracking(false);
      return;
    }

    const startPt = currentLocation ?? null;
    if (!startPt) {
      setIsTracking(false);
      return;
    }
    
    setStartLocation(startPt);
    setRoutePoints([startPt]);
  };

  const stopTrackingSession = async () => {
    setIsTracking(false);
    isTrackingRef.current = false;

    const finalPoint = currentLocation ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest })).coords;
    const endPt = {
      latitude: finalPoint.latitude,
      longitude: finalPoint.longitude,
      altitude: finalPoint.altitude,
    };
    setEndLocation(endPt);

    // 3. Save the entire route to the phone's local storage database
    const sessionData = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      start: startLocation,
      end: endPt,
      route: routePoints,
    };

    try {
      // You can load this later on a "History" page!
      await AsyncStorage.setItem(`jump_session_${sessionData.id}`, JSON.stringify(sessionData));
      console.log("Session saved to database!");
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  return (
    <TelemetryContext.Provider value={{ isTracking, currentLocation, startLocation, endLocation, routePoints, startTrackingSession, stopTrackingSession }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error('useTelemetry must be used within a TelemetryProvider');
  return context;
};