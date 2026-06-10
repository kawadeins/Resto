import * as SecureStore from "expo-secure-store";

const CUSTOMER_EMAIL_KEY = "customer_email";

export async function saveCustomerEmail(email: string) {
  await SecureStore.setItemAsync(CUSTOMER_EMAIL_KEY, email);
}

export async function getCustomerEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(CUSTOMER_EMAIL_KEY);
}

export async function clearCustomerEmail() {
  await SecureStore.deleteItemAsync(CUSTOMER_EMAIL_KEY);
}
