import * as Contacts from "expo-contacts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useCallback } from "react";
import type { Contact } from "@/context/MessagingContext";
import { mergeSyncedContacts } from "@/utils/contact-sync";

const CONTACTS_KEY = "@zivr_contacts";

export type SyncStatus = "idle" | "requesting" | "syncing" | "done" | "denied" | "error";

function generateId(index: number): string {
  return `synced_${Date.now()}_${index}`;
}

function mapDeviceContact(dc: Contacts.Contact, index: number): Contact | null {
  const name =
    dc.name ||
    [dc.firstName, dc.middleName, dc.lastName].filter(Boolean).join(" ").trim();
  if (!name) return null;

  const phone =
    dc.phoneNumbers && dc.phoneNumbers.length > 0
      ? dc.phoneNumbers[0].number ?? undefined
      : undefined;

  return {
    id: generateId(index),
    name,
    phone,
    avatar: dc.imageAvailable && dc.image?.uri ? dc.image.uri : undefined,
    isOnline: false,
    lastSeen: undefined,
  };
}

export function useContactSync() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [syncedCount, setSyncedCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const syncContacts = useCallback(async (): Promise<Contact[]> => {
    setStatus("requesting");
    setErrorMsg(null);

    try {
      const { status: permStatus } = await Contacts.requestPermissionsAsync();

      if (permStatus !== "granted") {
        setStatus("denied");
        return [];
      }

      setStatus("syncing");

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Image,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      const appContacts: Contact[] = [];
      data.forEach((dc, i) => {
        const mapped = mapDeviceContact(dc, i);
        if (mapped) appContacts.push(mapped);
      });

      const stored = await AsyncStorage.getItem(CONTACTS_KEY);
      let existing: Contact[] = stored ? JSON.parse(stored) : [];

      const merged = mergeSyncedContacts(existing, appContacts);
      await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(merged));

      setSyncedCount(appContacts.length);
      setStatus("done");
      return merged;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
      return [];
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setSyncedCount(0);
    setErrorMsg(null);
  }, []);

  return { status, syncedCount, errorMsg, syncContacts, reset };
}
