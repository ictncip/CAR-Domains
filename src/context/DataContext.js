import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION_NAME = 'records';

const DataContext = createContext(null);

function formatDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toInputDateValue(value) {
  if (!value) return '';
  if (typeof value?.toDate === 'function') {
    return formatDateInputValue(value.toDate());
  }
  if (value instanceof Date) {
    return formatDateInputValue(value);
  }
  return value;
}

function recordFromFirestore(docSnap) {
  const data = docSnap.data();
  if (!data) return null;
  return {
    id: docSnap.id,
    ...data,
    dateReceiptApplication: toInputDateValue(data.dateReceiptApplication),
    dateApprovedCeb: toInputDateValue(data.dateApprovedCeb),
    dateCommunityValidation: toInputDateValue(data.dateCommunityValidation),
    dateAdoptedLgu: toInputDateValue(data.dateAdoptedLgu),
  };
}

function recordToFirestore(record) {
  const { id, ...rest } = record;
  const out = {};
  Object.keys(rest).forEach((key) => {
    if (rest[key] !== undefined) out[key] = rest[key];
  });
  return out;
}

export function DataProvider({ children }) {
  const [records, setRecords] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);

  useEffect(() => {
    const colRef = collection(db, COLLECTION_NAME);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => recordFromFirestore(d));
        setRecords(list);
        setDataLoading(false);
        setDataError(null);
      },
      (err) => {
        setDataError(err?.message ?? 'Failed to load records');
        setDataLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const addRecord = useCallback(async (record) => {
    const payload = recordToFirestore(record);
    payload.createdAt = serverTimestamp();
    const ref = await addDoc(collection(db, COLLECTION_NAME), payload);
    return ref.id;
  }, []);

  const addRecords = useCallback(async (recordsToAdd) => {
    const BATCH_SIZE = 500;
    for (let i = 0; i < recordsToAdd.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = recordsToAdd.slice(i, i + BATCH_SIZE);
      chunk.forEach((record) => {
        const payload = recordToFirestore(record);
        payload.createdAt = serverTimestamp();
        const ref = doc(collection(db, COLLECTION_NAME));
        batch.set(ref, payload);
      });
      await batch.commit();
    }
  }, []);

  const updateRecord = useCallback(async (id, updates) => {
    await updateDoc(doc(db, COLLECTION_NAME, id), updates);
  }, []);

  const deleteRecord = useCallback(async (id) => {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  }, []);

  const deleteRecords = useCallback(async (ids) => {
    if (!ids?.length) return;
    const BATCH_SIZE = 500;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      ids.slice(i, i + BATCH_SIZE).forEach((id) => {
        batch.delete(doc(db, COLLECTION_NAME, id));
      });
      await batch.commit();
    }
  }, []);

  return (
    <DataContext.Provider
      value={{
        records,
        dataLoading,
        dataError,
        addRecord,
        addRecords,
        updateRecord,
        deleteRecord,
        deleteRecords,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
