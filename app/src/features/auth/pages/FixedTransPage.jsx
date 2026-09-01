import React, { useEffect, useMemo, useState } from "react";
import "./MyPage.css";
import { useAuth } from "../../../context/AuthContext";
import { fixedTransApi } from "../../../api/fixedTransApi";
import FixedTransModal from "./FixedTransModal";
import { IconReceipt } from "../../../components/icons";
import "./FixedTransPage.css";
import { useFeedback } from "../../../context/FeedbackContext";

export default function FixedTransPage() {
  const { user } = useAuth();
  const { toast, confirm } = useFeedback();
  const userId = user?.userId;

  const displayName = useMemo(() => {
    return user?.userName || user?.name || "회원";
  }, [user]);

  const [list, setList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // 수정 대상

  const fetchList = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const data = await fixedTransApi.list(userId);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast("고정지출 목록 조회 실패", { type: "error" });
      setList([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [userId]);

  const openCreate = () => {
    setEditTarget(null);
    setIsModalOpen(true);
  };

  const openEdit = (item) => {
    setEditTarget(item);
    setIsModalOpen(true);
  };

  const removeOne = async (fixedId) => {
    const ok = await confirm("삭제되면 되돌릴 수 없습니다. 정말 삭제하시겠습니까?", { danger: true });
    if (!ok) return;

    try {
      await fixedTransApi.remove(fixedId);
      toast("삭제가 완료되었습니다.", { type: "success" });
      fetchList();
    } catch (err) {
      console.error(err);
      toast("삭제에 실패하였습니다.", { type: "error" });
    }
  };

  return (
    <main className="fade-in">
      {/* 목록 */}
      <div className="account-book-grid">
        <div className="info-card ftMainCard" style={{ gridColumn: "1 / -1", paddingTop:'10px'}}>
          <div className="card-title-area" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap" }}>
              <h3 style={{ whiteSpace: "nowrap" }}>내 고정지출 목록</h3>
              <span className="status-dot" style={{ whiteSpace: "nowrap" }}>{list.length}개</span>
            </div>
            <button type="button" className="ftAddBtn" onClick={openCreate}>
              <span className="ftAddIcon" aria-hidden="true">＋</span>
              <span>추가</span>
            </button>
          </div>

          {isLoading ? (
            <p className="desc" style={{ marginTop: 16 }}>불러오는 중...</p>
          ) : list.length === 0 ? (
            <p className="desc" style={{ marginTop: 16 }}>아직 등록된 고정지출이 없어요. 우측 상단 버튼을 눌러 추가해 보세요!</p>
          ) : (
            <div className="ftList">
              {list.map((item) => (
                <div key={item.fixedId} className="ftRow">
                  <div className="ftRowMain">
                    <div className="ftRowName">
                      <IconReceipt size={15} className="ftRowIcon" aria-hidden="true" />
                      <span className="ftName">{item.name}</span>
                      <span className="status-dot">
                        {Number(item.payDay) === 31 ? "매달 말일" : `매달 ${item.payDay}일`}
                      </span>
                    </div>

                    <div className="ftRowSub">
                      <span>카테고리: {item.category}</span>
                      {item.transDate && <span>등록일: {String(item.transDate).slice(0, 10)}</span>}
                    </div>
                  </div>

                  <div className="ftAmount">{Number(item.amount).toLocaleString()}원</div>

                  <div className="ftRowActions">
                    <button type="button" className="ftBtn ftBtnEdit" onClick={() => openEdit(item)}>
                      수정
                    </button>
                    <button type="button" className="ftBtn ftBtnDelete" onClick={() => removeOne(item.fixedId)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>

          )}
        </div>
      </div>

      {/* 모달 */}
      {isModalOpen && (
        <FixedTransModal
          userId={userId}
          mode={editTarget ? "edit" : "create"}
          initialValue={editTarget}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchList}
        />
      )}
    </main>
  );
}
