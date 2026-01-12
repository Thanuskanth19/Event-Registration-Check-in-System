
/* 
  --- SUPABASE SQL SETUP SCRIPT (CLEAN RESET & SETUP) ---
  -- RUN THIS IN YOUR SUPABASE SQL EDITOR TO FIX COLUMN ERRORS --

  -- Drop existing tables to update schema
  drop table if exists participants cascade;
  drop table if exists registrations cascade;
  drop table if exists events cascade;
  drop table if exists users cascade;

  -- 1. Create Users Table
  create table users (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    email text unique not null,
    password text not null,
    role text not null check (role in ('student', 'organizer', 'admin')),
    uni_id text unique not null,
    profile_photo text,
    status text default 'approved' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamp with time zone default now()
  );

  -- 2. Create Events Table
  create table events (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    description text,
    organizer_name text,
    organizer_email text,
    organizer_id uuid references users(id) on delete cascade,
    department text,
    venue text,
    date date,
    start_time text,
    end_time text,
    max_participants integer default 50,
    status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
    poster_url text,
    created_at timestamp with time zone default now()
  );

  -- 3. Create Registrations Table
  create table registrations (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references users(id) on delete cascade,
    user_name text,
    event_id uuid references events(id) on delete cascade,
    event_title text,
    timestamp timestamp with time zone default now(),
    status text default 'registered' check (status in ('registered', 'checked-in')),
    qr_payload text,
    check_in_time timestamp with time zone
  );

  -- 4. Create Participants Table (Attendance Log)
  create table participants (
    id uuid default gen_random_uuid() primary key,
    registration_id uuid references registrations(id) on delete cascade,
    user_id uuid references users(id) on delete cascade,
    event_id uuid references events(id) on delete cascade,
    user_name text,
    event_title text,
    check_in_time timestamp with time zone default now()
  );

  -- 5. Initial Admin Seed
  insert into users (name, email, password, role, status, uni_id, profile_photo)
  values ('System Admin', 'admin@gmail.com', '123', 'admin', 'approved', 'ADMIN-001', '/admin.png')
  on conflict (email) do nothing;
*/

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, Event, Registration } from './types';

const SUPABASE_URL = (process.env as any).SUPABASE_URL || 'https://kfbnobnuqlnugqesdwmj.supabase.co';
const SUPABASE_ANON_KEY = (process.env as any).SUPABASE_ANON_KEY || 'sb_publishable_wHrJ8oJPCDLD6Kr75ItsPA_LgvqUZcD';

let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const mapUser = (data: any): User => ({
  _id: data.id,
  name: data.name,
  email: data.email,
  password: data.password,
  role: data.role,
  uniId: data.uni_id,
  profilePhoto: data.profile_photo,
  status: data.status || 'approved',
});

const mapEvent = (data: any): Event => ({
  _id: data.id,
  title: data.title,
  description: data.description,
  organizerName: data.organizer_name,
  organizerEmail: data.organizer_email,
  organizerId: data.organizer_id,
  department: data.department,
  venue: data.venue,
  date: data.date,
  startTime: data.start_time,
  endTime: data.end_time,
  maxParticipants: data.max_participants,
  status: data.status,
  createdAt: data.created_at,
  posterUrl: data.poster_url,
});

const mapReg = (data: any): Registration => ({
  _id: data.id,
  userId: data.user_id,
  userName: data.user_name,
  eventId: data.event_id,
  eventTitle: data.event_title,
  timestamp: data.timestamp,
  status: data.status,
  qrPayload: data.qr_payload,
  checkInTime: data.check_in_time,
});

export const DB = {
  isConfigured: () => !!supabase,

  init: async () => {
    if (!supabase) return;
    try {
      const { data: admin } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'admin@gmail.com')
        .maybeSingle();
      
      if (!admin) {
        await supabase.from('users').insert([{
          name: 'System Admin',
          email: 'admin@gmail.com',
          password: '123',
          role: 'admin',
          status: 'approved',
          uni_id: 'ADMIN-001',
          profile_photo: '/admin.png'
        }]);
      }
    } catch (e) {
      console.error("Database initialization check failed:", e);
    }
  },

  findUserByEmail: async (email: string): Promise<User | undefined> => {
    if (!supabase) throw new Error("Database not configured");
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    
    if (error) throw error;
    if (!data) return undefined;
    return mapUser(data);
  },

  createUser: async (user: Omit<User, '_id'>): Promise<User> => {
    if (!supabase) throw new Error("Database not configured");
    const status = user.role === 'organizer' ? 'pending' : 'approved';
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role,
          uni_id: user.uniId,
          profile_photo: user.profilePhoto,
          status: status
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return mapUser(data);
  },

  getAllUsers: async (): Promise<User[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('role', { ascending: true });
    
    if (error) return [];
    return data.map(mapUser);
  },

  getPendingUsers: async (): Promise<User[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'organizer')
      .eq('status', 'pending');
    
    if (error) return [];
    return data.map(mapUser);
  },

  updateUserStatus: async (userId: string, status: 'approved' | 'rejected'): Promise<boolean> => {
    if (!supabase) throw new Error("Database not configured");
    const { error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', userId);
    
    return !error;
  },

  getEvents: async (): Promise<Event[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) return [];
    return data.map(mapEvent);
  },

  createEvent: async (evt: Omit<Event, '_id' | 'status' | 'createdAt'>): Promise<Event> => {
    if (!supabase) throw new Error("Database not configured");
    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          title: evt.title,
          description: evt.description,
          organizer_name: evt.organizerName,
          organizer_email: evt.organizerEmail,
          organizer_id: evt.organizerId,
          department: evt.department,
          venue: evt.venue,
          date: evt.date,
          start_time: evt.startTime,
          end_time: evt.endTime,
          max_participants: evt.maxParticipants,
          poster_url: evt.posterUrl,
          status: 'pending'
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return mapEvent(data);
  },

  updateEventStatus: async (eventId: string, status: 'approved' | 'rejected'): Promise<boolean> => {
    if (!supabase) throw new Error("Database not configured");
    const { error } = await supabase
      .from('events')
      .update({ status })
      .eq('id', eventId);
    
    return !error;
  },

  deleteEvent: async (eventId: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('events').delete().eq('id', eventId);
  },

  registerForEvent: async (userId: string, userName: string, eventId: string, eventTitle: string): Promise<Registration | null> => {
    if (!supabase) throw new Error("Database not configured");
    const { data: existing } = await supabase
      .from('registrations')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .maybeSingle();
    
    if (existing) return null;

    const { data, error } = await supabase
      .from('registrations')
      .insert([
        {
          user_id: userId,
          user_name: userName,
          event_id: eventId,
          event_title: eventTitle,
          status: 'registered',
          qr_payload: `${eventId}:${userId}`,
          timestamp: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return mapReg(data);
  },

  getRegistrationsByUser: async (userId: string): Promise<Registration[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('user_id', userId);
    
    if (error) return [];
    return data.map(mapReg);
  },

  getRegistrationsByEvent: async (eventId: string): Promise<Registration[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('event_id', eventId);
    
    if (error) return [];
    return data.map(mapReg);
  },

  getAllParticipants: async (): Promise<any[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('check_in_time', { ascending: false });
    
    if (error) return [];
    return data;
  },
  
  checkInUser: async (qrPayload: string): Promise<{ success: boolean; message?: string; registration?: Registration }> => {
    if (!supabase) throw new Error("Database not configured");
    const { data: reg, error: fetchError } = await supabase
      .from('registrations')
      .select('*')
      .eq('qr_payload', qrPayload)
      .maybeSingle();
    
    if (fetchError || !reg) {
      return { success: false, message: 'Invalid registration code.' };
    }

    if (reg.status === 'checked-in') {
      return { success: false, message: 'Already checked in!', registration: mapReg(reg) };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('registrations')
      .update({ status: 'checked-in', check_in_time: now })
      .eq('id', reg.id);
    
    if (updateError) return { success: false, message: 'Check-in failed.' };

    await supabase.from('participants').insert([{
      registration_id: reg.id,
      user_id: reg.user_id,
      event_id: reg.event_id,
      user_name: reg.user_name,
      event_title: reg.event_title,
      check_in_time: now
    }]);

    const { data: finalReg } = await supabase
      .from('registrations')
      .select('*')
      .eq('id', reg.id)
      .single();

    return { success: true, registration: mapReg(finalReg) };
  }
};
