
export type UserRole = 'student' | 'organizer' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  indexNumber?: string;
  uniId: string; // University ID is now mandatory
  profilePhoto?: string; // Base64 encoded string
  status?: 'pending' | 'approved' | 'rejected';
}

export interface Event {
  _id: string;
  title: string;
  description: string;
  organizerName: string;
  organizerEmail: string;
  organizerId: string;
  department: string;
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  posterUrl?: string;
}

export interface Registration {
  _id: string;
  userId: string;
  userName: string;
  eventId: string;
  eventTitle: string;
  timestamp: string;
  status: 'registered' | 'checked-in';
  qrPayload: string;
  checkInTime?: string;
}
