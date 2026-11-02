export interface SmartScalarItem {
  title: string;
  current_value: number;
  previous_value: number;
  percent_change: number;
  formatted_value: string;
  trend_direction: "up" | "down" | "neutral";
  is_favorable: boolean;
  comparison_label: string;
}

export interface SummaryResponse {
  total_volume: SmartScalarItem;
  transaction_count: SmartScalarItem;
  fraud_volume: SmartScalarItem;
  fraud_rate: SmartScalarItem;
}

export interface TrendsResponse {
  dimensions: string[];
  total_volume: number[];
  fraud_volume: number[];
  fraud_rate_pct: number[];
  transaction_count: number[];
}

export interface ChannelBreakdownItem {
  channel: string;
  volume_usd: number;
  tx_count: number;
  fraud_count: number;
  fraud_amount_usd: number;
  fraud_rate_pct: number;
}

export interface CategoryBreakdownItem {
  mcc_desc: string;
  volume_usd: number;
  tx_count: number;
  fraud_count: number;
  fraud_amount_usd: number;
  fraud_rate_pct: number;
}

export interface CardBreakdownItem {
  name: string;
  value: number;
  percentage: number;
  tx_count: number;
  fraud_count: number;
}

export interface CardBreakdownResponse {
  by_brand: CardBreakdownItem[];
  by_type: CardBreakdownItem[];
}

export interface MerchantItem {
  merchant_id: number;
  merchant_city: string;
  merchant_state: string;
  mcc_desc: string;
  tx_count: number;
  total_amount: number;
  fraud_count: number;
  fraud_amount: number;
  fraud_rate_pct: number;
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface PaginatedMerchantsResponse {
  items: MerchantItem[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FilterOptionsResponse {
  date_bounds: {
    min_date: string;
    max_date: string;
    default_start: string;
    default_end: string;
  };
  channels: string[];
  card_brands: string[];
  card_types: string[];
  totals: {
    total_volume: number;
    total_transactions: number;
    total_fraud_count: number;
    total_fraud_amount: number;
    fraud_rate_pct: number;
  };
}

export interface FilterState {
  startDate: string;
  endDate: string;
  channel: string;
  cardBrand: string;
}
