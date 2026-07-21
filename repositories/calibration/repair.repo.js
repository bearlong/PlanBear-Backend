import supabase from "../../configs/supabase.js";

export async function getRepairLists(queryParams = {}) {
  const {
    pages = 1,
    property_no = "",
    apply_no = "",
    instru_name = "",
    applicant = "",
    start_date = undefined,
    end_date = "",
    factory = "",
    status = "",
  } = queryParams;
  const limit = 20;
  const offset = (pages - 1) * limit;
  let queryBuilder = supabase
    .schema(process.env.DB_SCHEMA)
    .from("gauge_instrument_repair_application")
    .select(
      `
    *,
    gauge_instrument_repair_item!inner(*)
    `,
      { count: "exact" },
    );

  if (property_no) {
    queryBuilder = queryBuilder.ilike(
      "gauge_instrument_repair_item.property_no",
      `%${property_no}%`,
    );
  }
  if (status && status !== "All") {
    queryBuilder = queryBuilder.eq("status", status);
  }
  if (apply_no) {
    queryBuilder = queryBuilder.ilike("apply_no", `%${apply_no}%`);
  }

  if (factory) {
    queryBuilder = queryBuilder.eq("factory", factory);
  }

  if (instru_name) {
    queryBuilder = queryBuilder.ilike(
      "gauge_instrument_repair_item.instru_name",
      `%${instru_name}%`,
    );
  }
  if (applicant) {
    queryBuilder = queryBuilder.eq("applicant", applicant);
  }

  if (start_date) {
    queryBuilder = queryBuilder.gte("created_at", start_date);
  }

  if (end_date) {
    queryBuilder = queryBuilder.lte("created_at", end_date);
  }

  queryBuilder = queryBuilder.range(offset, offset + limit - 1);
  queryBuilder = queryBuilder.order("id", { ascending: true });
  const { data, error, count } = await queryBuilder;
  const totalPages = Math.ceil(count / limit);
  if (error) {
    throw new Error(`Fetch calibration failed: ${error.message}`);
  }
  return { data, count, totalPages };
}

export async function getRepairApplicationByApplyNo(apply_no) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("gauge_instrument_repair_application")
    .select(
      `
      *,
      gauge_instrument_repair_item!inner(*, gauge_instrument_repair_item_file(*))
      `,
    )
    .eq("apply_no", apply_no)
    .single();

  if (error) {
    throw new Error(
      `Fetch repair application details failed: ${error.message}`,
    );
  }

  return { status: "success", data };
}

export async function insertRepairApplication(item) {
  for (let i = 0; i < 3; i++) {
    const { data: applyNo, error: applyNoError } = await supabase.schema(
      process.env.DB_SCHEMA,
    );

    if (applyNoError || !applyNo) {
      throw new Error(applyNoError?.message || "Failed to generate applyNo");
    }

    const applicationData = {
      ...item,
      apply_no: applyNo,
    };

    const { data, error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("gauge_instrument_repair_application")
      .insert([applicationData])
      .select("id")
      .single();
    if (!error) {
      return {
        id: data.id,
        apply_no: applyNo,
      };
    }

    if (error.code !== "23505") {
      throw new Error(`Insert repair application failed: ${error.message}`);
    }
  }

  throw new Error(
    "Insert repair application failed: unable to generate a unique apply_no after 3 retries",
  );
}

export async function insertRepairItem(item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("gauge_instrument_repair_item")
    .insert([item])
    .select("id")
    .single();
  if (error) {
    throw new Error(`Insert repair item failed: ${error.message}`);
  }
  return data;
}

export async function deleteRepairApplication(id) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("gauge_instrument_repair_application")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(`Delete repair application failed: ${error.message}`);
  }
  return data;
}

export async function updateRepairItemById(id, item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("gauge_instrument_repair_item")
    .update(item)
    .eq("id", id)
    .select("id")
    .single();
  if (error) {
    throw new Error(`Update repair item failed: ${error.message}`);
  }
  return data;
}

export async function updateRepairApplicationById(applicationId, item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("gauge_instrument_repair_application")
    .update(item)
    .eq("id", applicationId)
    .select("id")
    .single();
  if (error) {
    throw new Error(`Update repair application failed: ${error.message}`);
  }
  return data;
}

export async function insertRepairFile(item) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("gauge_instrument_repair_item_file")
    .insert([item])
    .select("id")
    .single();
  if (error) {
    throw new Error(`Insert repair file failed: ${error.message}`);
  }
  return data;
}

export async function deleteRepairFile(fileId) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("gauge_instrument_repair_item_file")
    .delete()
    .eq("id", fileId);
  if (error) {
    throw new Error(`Delete repair file failed: ${error.message}`);
  }
  return data;
}
