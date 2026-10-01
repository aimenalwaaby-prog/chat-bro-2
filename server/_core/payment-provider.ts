export type SubscriptionStatus = "active" | "trialing" | "canceled" | "past_due" | "incomplete";
export type PaymentSubscription = {
  providerSubscriptionId: string;
  customerId?: string;
  status: SubscriptionStatus;
  startedAt: Date;
  endsAt?: Date;
};

export interface PaymentProvider {
  createSubscription(input: { userId: number; plan: string; returnUrl?: string }): Promise<PaymentSubscription>;
  retrieveSubscription(providerSubscriptionId: string): Promise<PaymentSubscription>;
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  handleWebhook(payload: string, signature?: string): Promise<PaymentSubscription | null>;
}

export class DisabledPaymentProvider implements PaymentProvider {
  async createSubscription(): Promise<PaymentSubscription> { throw new Error("Payment provider is disabled until subscriptions are enabled."); }
  async retrieveSubscription(): Promise<PaymentSubscription> { throw new Error("Payment provider is not configured."); }
  async cancelSubscription(): Promise<void> { throw new Error("Payment provider is not configured."); }
  async handleWebhook(): Promise<PaymentSubscription | null> { return null; }
}

export function getPaymentProvider(): PaymentProvider {
  // A real provider can be injected here later without changing router contracts.
  return new DisabledPaymentProvider();
}
