// src/services/favoriteService.js
import supabase from "../configs/supabase.js";

export async function getFavorites(username) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("user_favorite_function")
    .select("function_key, display_order")
    .eq("username", username)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Fetch favorite failed: ${error.message}`);
  }
  return data || [];
}

export async function addFavorite(username, function_key) {
  try {
    const { count, error: dupErr } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("user_favorite_function")
      .select("function_key", { count: "exact", head: true })
      .eq("username", username)
      .eq("function_key", function_key);

    if (dupErr) {
      return { status: "error", message: dupErr.message };
    }

    if (count > 0) {
      return { status: "success", message: "Already exists" }; // 幂等（idempotent）
    }

    const { data: lastItem, error: lastErr } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("user_favorite_function")
      .select("display_order")
      .eq("username", username)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr && lastErr.code !== "PGRST116") {
      // 除了「沒有資料」以外都算錯
      return { status: "error", message: lastErr.message };
    }
    const newDisplayOrder = lastItem?.display_order
      ? lastItem.display_order + 1
      : 1;

    const uploadData = {
      username,
      function_key,
      display_order: newDisplayOrder,
    };

    const { error } = await supabase
      .schema(process.env.DB_SCHEMA)
      .from("user_favorite_function")
      .insert([uploadData]);

    if (error) {
      return { status: "error", message: error.message };
    }
    return { status: "success", message: "Favorite added successfully" };
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

export async function removeFavorite(username, function_key) {
  const { data, error } = await supabase
    .schema(process.env.DB_SCHEMA)
    .from("user_favorite_function")
    .delete()
    .eq("username", username)
    .eq("function_key", function_key);

  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "success", message: "Favorite removed successfully" };
}
