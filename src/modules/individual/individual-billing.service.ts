import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

export interface IndividualBillingPlan {
  planId: string | null;
  planName: string | null;
  price: number;
  cycle: string | null;
  isPaid: boolean;
  status: string | null;
  paymentMethod: string | null;
  selectedAt: string | null;
}

export interface IndividualBillingHistoryItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: 'Paid' | 'Pending' | 'Failed';
  invoiceNumber: string;
  paymentMethod: string | null;
  planId: string | null;
}

export interface IndividualBillingAccount {
  fullName: string;
  email: string;
  phone: string | null;
}

@Injectable()
export class IndividualBillingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  async getBilling(userId?: string) {
    if (!userId) {
      return { account: null, plan: null, history: [] as IndividualBillingHistoryItem[] };
    }

    try {
      await this.authService.reconcilePlanPayments(userId);
    } catch {
      // Billing still loads if Flutterwave cannot be reached.
    }

    const [user, planSetting, historySetting] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true, phone: true },
      }),
      this.prisma.platformSetting.findUnique({
        where: { key: `PLAN_USER_${userId}` },
      }),
      this.prisma.platformSetting.findUnique({
        where: { key: `BILLING_HISTORY_${userId}` },
      }),
    ]);

    const plan = this.parsePlan(planSetting?.value);
    let history = this.parseHistory(historySetting?.value);

    if (history.length === 0 && plan?.planName) {
      history = [this.historyFromPlan(userId, plan)];
    }

    const account: IndividualBillingAccount | null = user
      ? { fullName: user.fullName, email: user.email, phone: user.phone }
      : null;

    return { account, plan, history };
  }

  private parsePlan(value?: string | null): IndividualBillingPlan | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as {
        planId?: string;
        planName?: string;
        price?: number;
        cycle?: string;
        isPaid?: boolean;
        status?: string;
        paymentMethod?: string;
        selectedAt?: string;
        updatedAt?: string;
      };
      return {
        planId: parsed.planId ?? null,
        planName: parsed.planName ?? null,
        price: typeof parsed.price === 'number' ? parsed.price : 0,
        cycle: parsed.cycle ?? null,
        isPaid: parsed.isPaid === true || parsed.status === 'ACTIVE',
        status: parsed.status ?? null,
        paymentMethod: parsed.paymentMethod ?? null,
        selectedAt: parsed.selectedAt ?? parsed.updatedAt ?? null,
      };
    } catch {
      return null;
    }
  }

  private parseHistory(value?: string | null): IndividualBillingHistoryItem[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item, index) => this.normalizeHistoryItem(item, index))
        .filter((item): item is IndividualBillingHistoryItem => item !== null);
    } catch {
      return [];
    }
  }

  private normalizeHistoryItem(
    item: unknown,
    index: number,
  ): IndividualBillingHistoryItem | null {
    if (!item || typeof item !== 'object') return null;
    const row = item as Record<string, unknown>;
    const description = typeof row.description === 'string' ? row.description : '';
    if (!description) return null;
    const status = row.status === 'Paid' || row.status === 'Failed' ? row.status : 'Pending';
    return {
      id: typeof row.id === 'string' ? row.id : `bill_${index}`,
      date: typeof row.date === 'string' ? row.date : new Date().toISOString(),
      description,
      amount: typeof row.amount === 'number' ? row.amount : 0,
      currency: typeof row.currency === 'string' ? row.currency : 'NGN',
      status,
      invoiceNumber:
        typeof row.invoiceNumber === 'string' ? row.invoiceNumber : `INV-${index + 1}`,
      paymentMethod: typeof row.paymentMethod === 'string' ? row.paymentMethod : null,
      planId: typeof row.planId === 'string' ? row.planId : null,
    };
  }

  private historyFromPlan(
    userId: string,
    plan: IndividualBillingPlan,
  ): IndividualBillingHistoryItem {
    const date = plan.selectedAt || new Date().toISOString();
    const stamp = Date.parse(date);
    const year = Number.isNaN(stamp) ? new Date().getFullYear() : new Date(stamp).getFullYear();
    const status: IndividualBillingHistoryItem['status'] = plan.isPaid
      ? 'Paid'
      : plan.status === 'FAILED' || plan.status === 'CANCELLED'
        ? 'Failed'
        : 'Pending';

    return {
      id: `plan_${userId}`,
      date,
      description: plan.planName || 'Event pass',
      amount: plan.price,
      currency: 'NGN',
      status,
      invoiceNumber: `INV-${year}-${userId.slice(-6).toUpperCase()}`,
      paymentMethod: plan.paymentMethod,
      planId: plan.planId,
    };
  }
}
