import supabase from "../../configs/supabase.js";

function chunkArray(arr, size = 300) {
  const chunks = [];

  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }

  return chunks;
}

export async function getCalibrationLists(queryParams = {}) {
  const {
    pages = 1,
    paginate = true,
    searchQuery = "",
    status = "",
    factory = "",
    calibClass = "",
    instrumentId = undefined,
    dueDateFrom = "",
    dueDateTo = "",
    changeDateFrom = "",
    changeDateTo = "",
    oversee = "",
    standard = "",
    is_common = "",
    is_medical_equipment = "",
    onlyOverdue,
    reportApproval,
  } = queryParams;

  console.log(queryParams);
  const limit = 20;
  const offset = (pages - 1) * limit;
  let queryBuilder = supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_v")
    .select(
      `
    *,  
    instrument:calibration_list (id, instru_name, system),
    calibration_org:calibration_org (id, name)

  `,
      { count: "exact" },
    );
  const q = String(searchQuery).trim();
  if (q) {
    console.log(q);
    const safe = q.replace(/[%]/g, "\\%"); // 最低限度
    queryBuilder = queryBuilder.or(
      `property_no.ilike.%${safe}%,` +
        `vendor.ilike.%${safe}%,` +
        `model.ilike.%${safe}%,` +
        `owner.ilike.%${safe}%,` +
        `owner_username.ilike.%${safe}%,` +
        `description.ilike.%${safe}%,` +
        `instru_sn.ilike.%${safe}%,` +
        `sub_instru_id.ilike.%${safe}%,` +
        `dept.ilike.%${safe}%`,
    );
  }
  if (status) {
    queryBuilder = queryBuilder.eq("status", status);
  }

  if (factory) {
    queryBuilder = queryBuilder.eq("factory", factory);
  }
  if (calibClass) {
    queryBuilder = queryBuilder.eq("calibr_class", calibClass);
  }
  const hasInstrumentId =
    instrumentId !== null &&
    instrumentId !== undefined &&
    instrumentId !== "" &&
    instrumentId !== "null";
  if (hasInstrumentId) {
    queryBuilder = queryBuilder.eq("instru_id", Number(instrumentId));
  }
  if (dueDateFrom) {
    queryBuilder = queryBuilder.gte("due_date", dueDateFrom);
  }
  if (dueDateTo) {
    queryBuilder = queryBuilder.lte("due_date", dueDateTo);
  }

  if (changeDateFrom) {
    queryBuilder = queryBuilder.gte("change_date", changeDateFrom);
  }

  if (changeDateTo) {
    queryBuilder = queryBuilder.lte("change_date", changeDateTo);
  }

  if (oversee === "1" || oversee === "0") {
    queryBuilder = queryBuilder.eq("oversee", oversee === "1");
  }

  if (standard === "1" || standard === "0") {
    queryBuilder = queryBuilder.eq("standard", standard === "1");
  }

  if (is_common === "1" || is_common === "0") {
    queryBuilder = queryBuilder.eq("is_common", is_common === "1");
  }

  if (is_medical_equipment === "1" || is_medical_equipment === "0") {
    queryBuilder = queryBuilder.eq(
      "is_medical_equipment",
      is_medical_equipment === "1",
    );
  }

  if (onlyOverdue) {
    const today = new Date().toISOString().split("T")[0];
    queryBuilder = queryBuilder.lt("due_date", today);
  }
  if (reportApproval) {
    queryBuilder = queryBuilder.eq("report_approval", reportApproval);
  }
  if (paginate) {
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);
  }
  queryBuilder = queryBuilder.order("due_date", { ascending: true });
  const { data, error, count } = await queryBuilder;
  const totalPages = Math.ceil(count / limit);
  if (error) {
    throw new Error(`Fetch calibration failed: ${error.message}`);
  }

  return { data, count, totalPages: paginate ? totalPages : 1 };
}

export async function getCalibrationInfo(needItem = "*") {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_v")
    .select(needItem);
  if (error) {
    throw new Error(`Fetch calibration info failed: ${error.message}`);
  }
  return data;
}

export async function getCalibrationStatisticOptions() {
  const { data, error } = await supabase.schema(process.env.DB_SCHEMA);

  if (error) {
    throw new Error(
      `Fetch calibration statistic options failed: ${error.message}`,
    );
  }

  return data?.[0];
}

export async function getCalibrationById(id) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_v")
    .select(
      `*,
      instrument:calibration_list (id, instru_name, system),
      calibration_org:calibration_org (id, name),
      calibration_log:calibration_log (
      id,
      status, 
      created_at, 
      change_date
    )`,
    )
    .eq("id", id)
    .order("id", {
      foreignTable: "calibration_log",
      ascending: true,
    })
    .single();
  if (error) {
    throw new Error(`Fetch calibration by ID failed: ${error.message}`);
  }
  return data;
}

export async function getHistoryByCalibrationId(calibrationId) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_log")
    .select(`*, calibration_log_file(*)`)
    .eq("calibration_id", calibrationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Fetch calibration history failed: ${error.message}`);
  }
  return data;
}

export async function getAutoNoticeCalibrationByFactoryDept(factory, dept) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const before21Days = new Date(today);
  before21Days.setDate(before21Days.getDate() - 21);
  const before21DaysStr = before21Days.toISOString().split("T")[0];

  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_v")
    .select(
      `
      id,
      property_no,
      factory,
      dept,
      owner,
      owner_username,
      vendor,
      model,
      instru_sn,
      calibr_class,
      due_date,
      status,
      instrument:calibration_list (
        id,
        instru_name,
        system
      )
    `,
    )
    .eq("status", "Usable")
    .eq("received", false)
    .eq("factory", factory)
    .eq("dept", dept)
    .lt("due_date", todayStr)
    .gte("due_date", before21DaysStr)
    .order("factory", { ascending: true })
    .order("dept", { ascending: true })
    .order("owner_username", { ascending: true });

  if (error) {
    throw new Error(
      `Fetch auto notice calibration items failed: ${error.message}`,
    );
  }

  return data || [];
}

export async function getAutoNoticeBehindtime() {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_v")
    .select(
      `
      id,
      property_no,
      factory,
      dept,
      owner,
      owner_username,
      vendor,
      model,
      instru_sn,
      calibr_cycle,
      calibr_class,
      due_date,
      status,
      instrument:calibration_list (
        id,
        instru_name,
        system
      )
    `,
    )
    .eq("status", "Usable")
    .eq("received", false)
    .eq("factory", "PHT")
    .lt("due_date", today)
    .not("calibr_class", "eq", "NCR")
    .not("calibr_class", "eq", "Sub-Porperty")
    .order("factory", { ascending: true })
    .order("dept", { ascending: true })
    .order("owner_username", { ascending: true });

  if (error) {
    throw new Error(
      `Fetch auto notice behindtime calibration items failed: ${error.message}`,
    );
  }

  return data || [];
}
export async function getAutoNoticeRoom(startDate, endDate) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_v")
    .select(
      `
      id,
      property_no,
      factory,
      dept,
      owner,
      owner_username,
      vendor,
      model,
      instru_sn,
      calibr_cycle,
      calibr_class,
      due_date,
      status,
      instrument:calibration_list (
        id,
        instru_name,
        system
      )
    `,
    )
    .eq("status", "Usable")
    .eq("received", false)
    .gte("due_date", startDate)
    .lte("due_date", endDate)
    .order("factory", { ascending: true })
    .order("dept", { ascending: true })
    .order("owner_username", { ascending: true });

  if (error) {
    throw new Error(
      `Fetch auto notice room calibration items failed: ${error.message}`,
    );
  }

  return data || [];
}

export async function checkCalibrationDuplicate(property_no, factory) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration")
    .select("id")
    .eq("property_no", property_no)
    .eq("factory", factory)
    .limit(1);

  if (error) {
    throw new Error(`Check calibration duplicate failed: ${error.message}`);
  }

  return (data?.length ?? 0) > 0; // Duplicate exists
}

export async function getDistinctOwner() {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration")
    .select("owner, owner_username", { distinct: true })
    .order("owner_username", { ascending: true });

  if (error) {
    throw new Error(`Fetch distinct owners failed: ${error.message}`);
  }

  const seenUsernames = new Set();
  const seenNames = new Set();
  const result = [];
  (data || []).forEach((r) => {
    if (r.owner_username) {
      if (!seenUsernames.has(r.owner_username)) {
        seenUsernames.add(r.owner_username);
        result.push({
          owner: null,
          owner_username: r.owner_username,
        });
      }
      return;
    }

    if (r.owner) {
      if (!seenNames.has(r.owner)) {
        seenNames.add(r.owner);
        result.push({
          owner: r.owner,
          owner_username: null,
        });
      }
    }
  });

  return result;
}

export async function getExistingCalibrationsByPropertyNos(propertyNos = []) {
  const allRows = [];
  const chunks = chunkArray(propertyNos, 300);

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("calibration")
      .select("id, property_no, factory")
      .in("property_no", chunk);

    if (error) {
      throw new Error(`Fetch existing calibration failed: ${error.message}`);
    }

    allRows.push(...(data || []));
  }

  return allRows;
}

export async function insertCalibration(item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration")
    .insert([item])
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function insertCalibrationCost(item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_cost")
    .insert([item])
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateCalibrationById(id, item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration")
    .update(item)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateAllCalibration(ids, item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration")
    .update(item)
    .in("id", ids)
    .select("*");
  if (error) throw error;
  return data;
}

export async function updateCalibrationAllOwners(oldOwner, newOwner, dept) {
  const query = supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration")
    .update({ owner_username: newOwner, owner: null, dept })
    .or(`owner_username.eq.${oldOwner},owner.eq.${oldOwner}`);

  const { data, error } = await query.select();

  if (error) throw error;
  return data;
}

export async function updateCalibrationCost(id, item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_cost")
    .update(item)
    .eq("calibration_id", id)
    .select("id");
  if (error) throw error;
  return data;
}

export async function deleteCalibrationCost(id) {
  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration_cost")
    .delete()
    .eq("calibration_id", id);

  if (error) throw error;
}

export async function deleteCalibration(id) {
  const { error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("calibration")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
