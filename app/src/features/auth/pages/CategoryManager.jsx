import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useFeedback } from "../../../context/FeedbackContext";
import categoryApi from "../../../api/categoryApi";
import { IconSettings } from "../../../components/icons";
import "./CategoryManager.css";

// 설정 탭의 카테고리 관리.
// - 카드 본문: 지금 켜져 있는 카테고리만 알약(pill)로 두세 줄 나열해서 "현재 상태"만 보여준다.
// - 톱니바퀴 버튼: on/off 토글 + 커스텀 추가/삭제가 있는 관리 모달을 연다.
// 빠른 입력(nl-input) 쪽 개인화(자주 쓰는 카테고리 우선 추천)는 서버가 사용 이력으로 알아서 처리하므로
// 여기서는 "무엇을 선택지에 둘지"만 관리한다.
function CategoryManager() {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const userId = user?.userId;

  const [type, setType] = useState("OUT");
  const [manage, setManage] = useState({ defaults: [], custom: [] });
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const load = () => {
    if (!userId) return;
    categoryApi
      .manage(userId, type)
      .then((data) => setManage(data && data.defaults ? data : { defaults: [], custom: [] }))
      .catch(() => setManage({ defaults: [], custom: [] }));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, type]);

  // 관리 모달이 열려 있는 동안에는 배경 스크롤을 잠근다.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const toggleHidden = async (name, nextHidden) => {
    try {
      await categoryApi.setHidden(userId, type, name, nextHidden);
      load();
    } catch {
      toast("변경 중 오류가 발생했습니다.", { type: "error" });
    }
  };

  const addCustom = async () => {
    const name = newName.trim();
    if (!name || isAdding) return;

    setIsAdding(true);
    try {
      await categoryApi.add(userId, type, name);
      setNewName("");
      load();
    } catch (err) {
      toast(err?.data?.message || "카테고리를 추가할 수 없습니다.", { type: "error" });
    } finally {
      setIsAdding(false);
    }
  };

  const removeCustom = async (categoryId) => {
    try {
      await categoryApi.remove(categoryId);
      load();
    } catch {
      toast("삭제 중 오류가 발생했습니다.", { type: "error" });
    }
  };

  // 카드 본문에 보여줄, 지금 켜져 있는 카테고리 목록(기본 중 숨김 아님 + 커스텀 전부).
  const activeChips = [
    ...manage.defaults
      .filter((d) => !d.hidden)
      .map((d) => ({ key: d.name, name: d.name, custom: false })),
    ...manage.custom.map((c) => ({ key: `c-${c.categoryId}`, name: c.name, custom: true })),
  ];

  const renderTypeSeg = (className) => (
    <div className={`ps-theme-seg ${className}`} role="group" aria-label="카테고리 종류 선택">
      <button
        type="button"
        className={`ps-theme-opt ${type === "OUT" ? "active" : ""}`}
        aria-pressed={type === "OUT"}
        onClick={() => setType("OUT")}
      >
        지출
      </button>
      <button
        type="button"
        className={`ps-theme-opt ${type === "IN" ? "active" : ""}`}
        aria-pressed={type === "IN"}
        onClick={() => setType("IN")}
      >
        수입
      </button>
    </div>
  );

  return (
    <div className="info-card ps-card cm-card">
      <div className="cm-header">
        <div className="cm-header-text">
          <div className="ps-theme-title">카테고리 관리</div>
          <div className="ps-theme-desc">
            지금 사용 중인 카테고리예요. 톱니바퀴에서 켜고 끄거나 새로 추가할 수 있어요.
          </div>
        </div>
        <button
          type="button"
          className="cm-gear-btn"
          onClick={() => setIsOpen(true)}
          aria-label="카테고리 설정 열기"
        >
          <IconSettings size={20} />
        </button>
      </div>

      {renderTypeSeg("cm-preview-seg")}

      <div className="cm-active-box">
        {activeChips.length === 0 ? (
          <span className="cm-empty">표시할 카테고리가 없어요</span>
        ) : (
          activeChips.map((chip) => (
            <span key={chip.key} className={`cm-chip ${chip.custom ? "cm-chip-custom" : ""}`}>
              {chip.name}
            </span>
          ))
        )}
      </div>

      {isOpen && (
        <div className="cm-modal-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="cm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="카테고리 설정"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-modal-head">
              <div className="cm-modal-title">카테고리 설정</div>
              <button
                type="button"
                className="cm-modal-close"
                onClick={() => setIsOpen(false)}
                aria-label="닫기"
              >
                &times;
              </button>
            </div>

            {renderTypeSeg("cm-modal-seg")}

            <div className="cm-list">
              {manage.defaults.map((d) => (
                <div key={d.name} className="cm-row">
                  <span className={`cm-name ${d.hidden ? "cm-name-hidden" : ""}`}>{d.name}</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={!d.hidden}
                      onChange={(e) => toggleHidden(d.name, !e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}

              {manage.custom.map((c) => (
                <div key={c.categoryId} className="cm-row">
                  <span className="cm-name">
                    {c.name}
                    <span className="cm-custom-badge">커스텀</span>
                  </span>
                  <button
                    type="button"
                    className="ps-link-btn"
                    onClick={() => removeCustom(c.categoryId)}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>

            <div className="cm-add-row">
              <input
                className="ps-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustom();
                }}
                placeholder="새 카테고리 이름"
                maxLength={50}
              />
              <button
                type="button"
                className="cm-add-btn"
                onClick={addCustom}
                disabled={isAdding || !newName.trim()}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryManager;
