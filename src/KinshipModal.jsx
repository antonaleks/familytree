export default function KinshipModal({ a, b, r, onClose }) {
  return (
    <div className="ft-overlay" onClick={e => {
      if (e.target.classList.contains('ft-overlay')) onClose();
    }}>
      <div className="ft-modal">
        <h3>Кто кому кем</h3>
        <p><b>{b.fio}</b> приходится <b>{a.fio}</b>:</p>
        <p className="ft-term">{r.term}</p>
        {r.def && (
          <p className="ft-def">
            {r.def}{' '}
            <a href={r.src} target="_blank" rel="noopener noreferrer">подробнее</a>
          </p>
        )}
        <button className="ft-close" onClick={onClose}>×</button>
      </div>
    </div>
  );
}
