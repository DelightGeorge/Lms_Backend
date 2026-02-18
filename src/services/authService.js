import API from "../api";

export const registerUser = (data) => API.post("/auth/register", data);

export const loginUser = async (data) => {
  const res = await API.post("/auth/login", data);
  const { token, user } = res.data;
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
  return res;
};

export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};