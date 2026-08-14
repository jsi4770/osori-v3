import React, { useEffect, useMemo, useState } from "react";
import { fixedTransApi } from "../../../api/fixedTransApi";
import "./FixedTransModal.css";
import { useFeedback } from "../../../context/FeedbackContext";
import useCategories from "../../../hooks/useCategories";

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
    transDate: today, // DB에 NOT NULL이라 일단 오늘로 보냄(서버에서 sysdate로 처리해도 됨)
  });

  // 결제일: 숫자 입력(1~30) + "매월 말일" 체크박스. 체크 시 서버에는 31로 전달되고
  // (31은 매달 말일로 클램핑되어 처리됨), 숫자 입력은 비활성화된다.
  const [payDayInput, setPayDayInput] = useState(1);
  const [isLastDay, setIsLastDay] = useState(false);

  useEffect(() => {
    if (isEdit && initialValue) {
      setForm({
        name: initialValue.name ?? "",
        amount: initialValue.amount ?? "",
        category: initialValue.category ?? "",
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
        amount: Number(form.amount),
        category: form.category.toString().trim(),
        payDay: isLastDay ? 31 : Number(payDayInput),
        transDate: form.transDate,
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
          <input
            className="ftmInput"
            id="amount"
            name="amount"
            type="number"
            placeholder="예) 15000"
            value={form.amount}
            onChange={onChange}
          />

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
            <button className="ftmBtn ftmPrimary" type="submit" disabled={isLoading}>
              {isLoading ? "처리중..." : isEdit ? "수정" : "추가"}
            </button>
            <button className="ftmBtn ftmGhost" type="button" onClick={onClose} disabled={isLoading}>
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

