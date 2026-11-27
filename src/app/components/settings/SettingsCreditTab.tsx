import { CreditBalanceCard } from "@/app/components/pricing/CreditBalanceCard";
import { CreditHistorySection } from "@/app/components/pricing/CreditHistorySection";
import { SettingsSectionHead as SectionHead } from "./SettingsKit";
import { useCreditBalance } from "@/app/state/creditBalance";
import { useSubscription } from "@/app/state/subscription";


/**
 * 설정 > 크레딧·사용 내역 — 잔액과 크레딧 내역만 다룬다. 현재 플랜 카드·구독 상태·
 * "구독 및 결제 관리" 링크는 여기 없다(설정 > 구독·결제로 이동, SettingsBillingTab).
 * 결제 실패 배너도 여기 두지 않는다 — 크레딧이 아니라 구독·결제 문제라 그 탭에서
 * 다룬다(중복 노출 금지).
 */
export function SettingsCreditTab({ onTopUp }: { onTopUp: () => void }) {
  const [liveBalance] = useCreditBalance();
  const subscription = useSubscription();

  return (
    <div className="flex flex-col gap-5">
      <SectionHead title="크레딧" desc="남은 크레딧과 사용 내역을 확인할 수 있어요." />
      <CreditBalanceCard liveBalance={liveBalance} subscription={subscription} onTopUp={onTopUp} />
      <CreditHistorySection />
    </div>
  );
}

export default SettingsCreditTab;
