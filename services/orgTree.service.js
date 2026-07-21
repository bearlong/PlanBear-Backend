import supabase from "../configs/supabase.js";

export async function getOrgTree() {
  // 1) 撈部門
  const { data: depts, error: deptErr } = await supabase
    .schema(process.env.DB_SCHEMA)
    .rpc("get_dept_tree");
  if (deptErr) throw new Error(deptErr.message);

  // 2) 建立部門 Map
  const deptMap = new Map();
  (depts || []).forEach((d) => {
    deptMap.set(d.dept, {
      id: `dept:${d.dept}`,
      type: "dept",
      dept: d.dept,
      name: d.dept_name,
      level: d.level,
      children: [],
    });
  });

  // 3) 串接部門層級
  const roots = [];
  (depts || []).forEach((d) => {
    const node = deptMap.get(d.dept);
    if (!node) return;

    if (d.up_dept === "0" || !d.up_dept) {
      roots.push(node);
    } else {
      const parent = deptMap.get(d.up_dept);
      if (parent) parent.children.push(node);
    }
  });

  // 4) 每個部門底下加 members placeholder（不載入 users）

  // 5) 排序：dept 在前、members 在後（users 不在這裡排序）
  function sortNode(node) {
    node.children.sort((a, b) => {
      const rank = (x) =>
        x.type === "dept" ? 0 : x.type === "members" ? 1 : 2;
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;

      return (a.name || a.label || "").localeCompare(
        b.name || b.label || "",
        "zh-Hant",
      );
    });

    node.children.filter((c) => c.type === "dept").forEach(sortNode);
  }

  roots.forEach(sortNode);
  return roots;
}

export async function getDeptUsersByDept(
  dept,
  { limit = 200, offset = 0 } = {},
) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .rpc("get_dept_users_by_dept", {
      p_dept: dept,
      p_limit: limit,
      p_offset: offset,
    });

  if (error) throw new Error(error.message);

  return (data || []).map((u) => ({
    id: crypto.randomUUID(),
    type: "user",
    username: u.username,
    fullname: u.fullname,
    ename: u.ename,
    job_title: u.job_title,
    label: `${u.ename ? u.ename + " " : ""}${u.fullname} (${u.username}, ${u.job_title})`,
  }));
}

export async function searchUser(query) {
  const { data: users, error: userErr } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("b_user")
    .select("username, fullname, ename, job_title, dept ")
    .or(
      `fullname.ilike.%${query}%,` +
        `ename.ilike.%${query}%,` +
        `username.ilike.%${query}%`,
    );

  if (userErr) throw new Error(userErr.message);
  const deptCodes = [
    ...new Set((users || []).map((u) => u.dept).filter(Boolean)),
  ];
  let deptNameMap = new Map();
  if (deptCodes.length > 0) {
    const { data: depts, error: deptErr } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("b_dept")
      .select("dept, dept_name")
      .in("dept", deptCodes);
    if (deptErr) throw new Error(deptErr.message);
    deptNameMap = new Map((depts || []).map((d) => [d.dept, d.dept_name]));
  }

  return (users || []).map((u) => ({
    id: crypto.randomUUID(),
    type: "user",
    username: u.username,
    fullname: u.fullname,
    ename: u.ename,
    dept: deptNameMap.get(u.dept) || "",
    job_title: u.job_title,
    label: `${u.ename ? u.ename + " " : ""}${u.fullname} (${u.username}, ${u.job_title})`,
  }));
}
