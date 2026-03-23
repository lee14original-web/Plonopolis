{FARM_HITBOXES.map((box) => (
  <div
    key={box.id}
    onClick={() => handle(box.action)}
    style={{
      position: "absolute",
      left: `${box.left}%`,
      top: `${box.top}%`,
      width: `${box.width}%`,
      height: `${box.height}%`,
    }}
  >
    {debug && <span>{box.label}</span>}
  </div>
))}
