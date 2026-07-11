export const ACTION_META = {
  login:             { icon: "sign-in-alt",   color: "blue"   },
  create_conference: { icon: "plus-circle",   color: "green"  },
  update_conference: { icon: "edit",          color: "blue"   },
  delete_conference: { icon: "trash",         color: "red"    },
  update_profile:    { icon: "user-edit",     color: "purple" },
  change_password:   { icon: "key",           color: "orange" },
};

export const actionMeta = (action) => ACTION_META[action] || { icon: "circle", color: "blue" };

export function relTime(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
