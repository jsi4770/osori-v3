import React, { useEffect, useMemo, useState } from "react";
import { fixedTransApi } from "../../../api/fixedTransApi";
import "./FixedTransModal.css";
import { useFeedback } from "../../../context/FeedbackContext";
import { Button } from "../../../components/ui";
import useCategories from "../../../hooks/useCategories";
import { CURRENCIES, isForeign } from "../../../constants/currencies";
import fxApi from "../../../api/fxApi";

export default function FixedTransModal({
  userId,
  mode = "create", // "create" | "edit"
  initialValue = null, // 수정 시 기존 값
  onClose,
  onSuccess,
}) {
  const { toast } = useFeedback();
  const isEdit = mode === "edit";
  // 고정지출은 항상 지출(OUT)이라 수입 카테고리 개념이 없음
  const [CATEGORY_OPTIONS] = useCategories(userId, "OUT");

  const today = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "",
    currency: "KRW", // KRW면 amount가 원화, 그 외면 amount는 "외화 금액"
    transDate: today, // DB에 NOT NULL이라 일단 오늘로 보냄(서버에서 sysdate로 처리해도 됨)
  });

  // 외화 고정지출: 대략적인 원화 환산 미리보기용 환율(KRW per 1단위). 실제 매달 등록 시엔 결제일 환율로 재환산된다.
  const [fxRate, setFxRate] = useState(null);
  const [fxInfo, setFxInfo] = useState(null);

  // 결제일: 숫자 입력(1~30) + "매월 말일" 체크박스. 체크 시 서버에는 31로 전달되고
  // (31은 매달 말일로 클램핑되어 처리됨), 숫자 입력은 비활성화된다.
  const [payDayInput, setPayDayInput] = useState(1);
  const [isLastDay, setIsLastDay] = useState(false);

  useEffect(() => {
    if (isEdit && initialValue) {
      const initCurrency = initialValue.currency ?? "KRW";
      setForm({
        name: initialValue.name ?? "",
        // 외화 고정지출이면 금액칸엔 외화 원본 금액을 보여준다.
        amount: (isForeign(initCurrency) ? initialValue.fxAmount : initialValue.amount) ?? "",
        category: initialValue.category ?? "",
        currency: initCurrency,
        transDate: (initialValue.transDate ?? today)?.toString().slice(0, 10),
      });

      const payDayNum = Number(initialValue.payDay ?? 1);
      if (payDayNum >= 31) {
        setIsLastDay(true);
      } else {
        setIsLastDay(false);
        setPayDayInput(payDayNum);
      }
    }
  }, [isEdit, initialValue, today]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 외화면 대략적인 원화 환산 미리보기용으로 오늘 환율을 불러온다.
  useEffect(() => {
    const foreign = isForeign(form.currency);
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (!foreign) {
        setFxRate(null);
        setFxInfo(null);
        return;
      }
      fxApi.rate(form.currency)
        .then((data) => {
          if (cancelled) return;
          setFxRate(Number(data?.rate) || null);
          setFxInfo({ rateDate: data?.rateDate, stale: !!data?.stale });
        })
        .catch(() => { if (!cancelled) { setFxRate(null); setFxInfo(null); } });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [form.currency]);

  const ftmForeign = isForeign(form.currency);
  const ftmAmountNum = Number(form.amount) || 0;
  const ftmApproxKrw = fxRate ? Math.round(ftmAmountNum * fxRate) : 0;

  const onChangePayDay = (e) => {
    setPayDayInput(e.target.value);
  };

  const onToggleLastDay = (e) => {
    setIsLastDay(e.target.checked);
  };

  const validate = () => {
    if (!form.name.trim()) return "고정지출 이름을 입력해주시기 바랍니다.";
    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) return "금액은 0원보다 커야합니다.";
    if (!form.category?.toString().trim()) return "카테고리를 선택해주시기 바랍니다.";
    if (!isLastDay) {
      const payDayNum = Number(payDayInput);
      if (!Number.isInteger(payDayNum) || payDayNum < 1 || payDayNum > 30) return "결제일은 1일~30일 사이어야합니다.";
    }
    if (ftmForeign && !fxRate) return "환율을 불러오는 중이에요. 잠시 후 다시 시도해주세요.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const msg = validate();
    if (msg) return toast(msg, { type: "error" });

    setIsLoading(true);
    try {
      const payload = {
        userId,
        name: form.name.trim(),
        // 외화면 amount(원화)는 참고값(오늘 환율 기준). 매달 등록 시 결제일 환율로 재환산된다.
        amount: ftmForeign ? ftmApproxKrw : Number(form.amount),
        category: form.category.toString().trim(),
        payDay: isLastDay ? 31 : Number(payDayInput),
        transDate: form.transDate,
        currency: ftmForeign ? form.currency : "KRW",
        fxAmount: ftmForeign ? Number(form.amount) : null,
      };

      if (isEdit) {
        //await fixedTransApi.update(initialValue.fixedId, payload);
        await fixedTransApi.update({...payload, fixedId: initialValue.fixedId});
        toast("수정이 완료되었습니다.", { type: "success" });
      } else {
        await fixedTransApi.create(payload);
        toast("고정지출이 등록되었습니다.", { type: "success" });
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      toast("고정지출 오류가 발생했습니다.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ftmOverlay" onMouseDown={onClose}>
      <div className="ftmModal" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="ftmTitle">{isEdit ? "고정지출 수정" : "고정지출 추가"}</h3>

        <form onSubmit={handleSubmit} className="ftmForm">
          <label className="ftmLabel" htmlFor="name">
            이름
          </label>
          <input
            className="ftmInput"
            id="name"
            name="name"
            type="text"
            placeholder="예) 넷플릭스, 월세, 통신비"
            value={form.name}
            onChange={onChange}
          />

          <label className="ftmLabel" htmlFor="amount">
            금액
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="ftmInput"
              id="amount"
              name="amount"
              type="number"
              step="any"
              placeholder="예) 15000"
              value={form.amount}
              onChange={onChange}
              style={{ flex: 1 }}
            />
            <select
              className="ftmInput"
              name="currency"
              value={form.currency}
              onChange={onChange}
              aria-label="통화 선택"
              style={{ flex: "0 0 auto", width: 104, fontWeight: 600 }}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code === "KRW" ? "원" : `${c.symbol} ${c.code}`}
                </option>
              ))}
            </select>
          </div>
          {ftmForeign && (
            <div style={{ marginTop: 6, fontSize: "0.82rem", color: "var(--text-weak, #6b7280)", lineHeight: 1.5 }}>
              {fxRate
                ? <>
                    ≈ <strong>{ftmApproxKrw.toLocaleString()}원</strong>
                    {" "}(1 {form.currency} = {fxRate.toLocaleString()}원{fxInfo?.stale ? ", 추정" : ""})
                    <br />매달 결제일 환율로 다시 환산해 등록돼요.
                  </>
                : "환율 불러오는 중…"}
            </div>
          )}

          <label className="ftmLabel" htmlFor="category">
            카테고리
          </label>
          <div className="ftmSelectWrap">
            <select
              className="ftmSelect"
              id="category"
              name="category"
              value={form.category}
              onChange={onChange}
            >
              <option value="" disabled>
                카테고리 선택
              </option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="ftmSelectArrow" aria-hidden="true">
              ▾
            </span>
          </div>

          <label className="ftmLabel" htmlFor="payDay">
            결제일(매달)
          </label>
          <div className="ftmPayDayRow">
            <input
              className="ftmInput ftmPayDayInput"
              id="payDay"
              name="payDay"
              type="number"
              min={1}
              max={30}
              placeholder="예) 5"
              value={isLastDay ? "" : payDayInput}
              onChange={onChangePayDay}
              disabled={isLastDay}
            />
            <label className="ftmCheckLabel">
              <input
                type="checkbox"
                checked={isLastDay}
                onChange={onToggleLastDay}
              />
              매월 말일
            </label>
          </div>

          <input type="hidden" name="transDate" value={form.transDate} readOnly />

          <div className="ftmButtonGroup">
            <Button variant="primary" size="md" block type="submit" disabled={isLoading}>
              {isLoading ? "처리중..." : isEdit ? "수정" : "추가"}
            </Button>
            <Button variant="subtle" size="md" block type="button" onClick={onClose} disabled={isLoading}>
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

